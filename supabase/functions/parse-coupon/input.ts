/** Keep the original message: linked pages may only list participating stores. */
export function combineCouponInput(text: string, sourceUrl: string, pageText: string): string {
  return [
    text.trim() ? `ההודעה המקורית:\n${text}` : '',
    `קישור עמוד הקופון: ${sourceUrl}\n\nתוכן העמוד (מידע משלים להודעה המקורית):\n${pageText}`,
  ].filter(Boolean).join('\n\n');
}
