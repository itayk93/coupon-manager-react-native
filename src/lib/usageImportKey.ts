// Idempotency keys for usage submissions. One key per user intent (one tap of
// the submit button); a retried submission of the same intent must reuse the
// key so the server can recognise the replay and not insert twice. The batch
// path has done this since 20260829170000; the single-usage path gained
// server support in migration 20261114190000.
export function makeUsageImportKey(prefix: string = "manual"): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

// One holder per submit-intent site (a modal's submit button, a confirm
// dialog). get() returns the SAME key for every attempt of one intent, so a
// timeout retry or a double tap reaches the server as a replay and inserts
// nothing twice. reset() runs after a success or when the intent is
// abandoned (modal closed), so the next, genuinely distinct submission gets
// a fresh key and is never mistaken for a replay.
export function createUsageIntentKeyHolder(prefix?: string): {
  get: () => string;
  reset: () => void;
} {
  let key: string | null = null;
  return {
    get() {
      if (key === null) key = makeUsageImportKey(prefix);
      return key;
    },
    reset() {
      key = null;
    },
  };
}
