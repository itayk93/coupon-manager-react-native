/**
 * Runs `task` over `items` with at most `concurrency` in flight, and reports
 * which items failed instead of stopping at the first failure.
 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<unknown>
): Promise<{ failed: T[]; firstError: unknown }> {
  const failed: T[] = [];
  let firstError: unknown = undefined;
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (error) {
        if (!failed.length) firstError = error;
        failed.push(item);
      }
    }
  };
  const workers = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return { failed, firstError };
}
