import { supabase } from "@/integrations/supabase/client";

/**
 * Tell the server that something happened worth notifying someone about.
 *
 * The app reports the event; the server decides whether to send anything, to
 * whom, on which channels, and in what words. That split is deliberate: a
 * share lands in another person's notifications, which no client may write,
 * and putting the wording here would mean the copy for one kind of message
 * changes only when people install an update.
 *
 * Fire-and-forget, like the activity log: the user did the thing, and the
 * thing succeeded. A notification that failed to send must never turn into an
 * error on top of a successful action.
 */
export function notifyEvent(
  event: "share_received" | "coupon_finished",
  payload: { couponId: number; recipientEmail?: string },
): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      await supabase.functions.invoke("notify-event", { body: { event, ...payload } });
    } catch {
      // Deliberately silent. See above.
    }
  })();
}
