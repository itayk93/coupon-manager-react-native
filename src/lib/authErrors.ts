/**
 * Turning a failed sign-in into something a person can act on.
 *
 * The legacy login path goes through an Edge Function, and supabase-js reports
 * a request that never completed — the connection dropped, the page navigated
 * away mid-flight, the app was backgrounded — as a `FunctionsFetchError` whose
 * message is the English "Failed to send a request to the Edge Function". That
 * string reached the user's screen verbatim, in an app that is otherwise all
 * Hebrew, and it reads like a broken password when the password was in fact
 * fine.
 *
 * A transport failure and a wrong password call for different actions: one is
 * "try again", the other is "check what you typed". Say which.
 */

export const CONNECTION_INTERRUPTED = "החיבור נקטע לפני שההתחברות הושלמה. נסו שוב.";
export const GENERIC_LOGIN_FAILURE = "ההתחברות נכשלה. נסה שוב.";

/** True when the request never reached a verdict, as opposed to being refused. */
export function isTransportError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  if (name === "FunctionsFetchError" || name === "TypeError" || name === "AbortError") return true;
  return /failed to send a request|failed to fetch|network request failed|load failed|networkerror/i.test(
    message
  );
}

/**
 * What to show the user.
 *
 * `serverMessage` is the function's own Hebrew answer ("אימייל או סיסמה
 * שגויים", "עליך לאשר את חשבונך…") and always wins: the server got the request
 * and made a decision about it.
 */
export function loginErrorMessage(error: unknown, serverMessage?: string | null): string {
  const server = typeof serverMessage === "string" ? serverMessage.trim() : "";
  if (server) return server;
  if (isTransportError(error)) return CONNECTION_INTERRUPTED;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : GENERIC_LOGIN_FAILURE;
}
