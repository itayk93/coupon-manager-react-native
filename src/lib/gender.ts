/**
 * Which way to inflect a Hebrew verb for the person reading it.
 *
 * Hebrew has no neutral imperative, so every instruction the app gives has to
 * pick one. `users.gender` is free text with a history — the old web app wrote
 * Hebrew words, later sign-ups write English ones — so the check accepts both
 * and defaults to masculine when the field is empty or says something else.
 * A default is unavoidable; masculine is the one Hebrew uses for an unknown
 * reader, and it matches the wording everywhere else in the app.
 */
const FEMALE = new Set(["female", "f", "woman", "נקבה", "אישה", "נשי"]);

export function isFemaleUser(gender: string | null | undefined): boolean {
  return FEMALE.has((gender || "").trim().toLowerCase());
}
