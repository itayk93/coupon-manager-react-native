import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_EVENTS_PER_REQUEST,
  type ActivityAction,
} from "../../supabase/functions/_shared/activityEvents";

/**
 * A fire-and-forget queue for what the user is doing.
 *
 * Every rule here follows from one constraint: analytics must never be able to
 * slow the app down, block a screen, or surface an error to a person who was
 * trying to use a coupon. So nothing awaits a flush, nothing throws, and a
 * failed send drops its events rather than retrying forever and growing.
 *
 * Events are batched because a screen change can produce several within a
 * second, and one request per tap would cost more than the data is worth.
 */

type QueuedEvent = {
  action: ActivityAction;
  coupon_id?: number | null;
  occurred_at: string;
  metadata?: Record<string, string | number | boolean> | null;
};

/** Long enough to collect a burst of navigation, short enough to survive a kill. */
const FLUSH_INTERVAL_MS = 10_000;
/** Beyond this the queue is dropped oldest-first: a backlog is not worth memory. */
const MAX_QUEUE = 200;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let started = false;

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushActivityLog();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Send whatever is queued. Safe to call at any time; concurrent calls collapse
 * into the one already running.
 */
export async function flushActivityLog(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;

  // Taken out of the queue up front: anything logged during the request
  // belongs to the next batch, not this one.
  const batch = queue.slice(0, MAX_EVENTS_PER_REQUEST);
  queue = queue.slice(batch.length);

  try {
    // Signed out, or the session expired: the server would reject the batch,
    // and there is no user to attribute it to anyway.
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    await supabase.functions.invoke("log-activity", { body: { events: batch } });
  } catch {
    // Dropped on purpose. Re-queueing a batch that failed because the device
    // is offline turns a bad network into an unbounded queue.
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

/**
 * Record one thing the user did.
 *
 * Synchronous and non-throwing by design — call it inline from a handler
 * without awaiting or wrapping it.
 */
export function logActivity(
  action: ActivityAction,
  options: {
    couponId?: number | null;
    screen?: string;
    metadata?: Record<string, string | number | boolean>;
  } = {}
): void {
  try {
    const metadata = {
      ...(options.screen ? { screen: options.screen } : {}),
      ...(options.metadata || {}),
    };

    queue.push({
      action,
      coupon_id: options.couponId ?? null,
      occurred_at: new Date().toISOString(),
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });

    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

    // A full batch goes now rather than waiting out the timer.
    if (queue.length >= MAX_EVENTS_PER_REQUEST) void flushActivityLog();
    else scheduleFlush();
  } catch {
    // Never let logging break the thing being logged.
  }
}

/**
 * Flush when the app leaves the foreground, which is the last moment before
 * the OS may stop giving us cycles.
 */
export function startActivityLog(): () => void {
  if (started) return () => {};
  started = true;

  const onChange = (state: AppStateStatus) => {
    if (state !== "active") void flushActivityLog();
  };
  const subscription = AppState.addEventListener("change", onChange);

  return () => {
    subscription.remove();
    started = false;
  };
}

/** Testing seam: drop anything queued without sending it. */
export function resetActivityLog(): void {
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  flushing = false;
}
