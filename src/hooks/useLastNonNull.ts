import { useRef } from "react";

/**
 * The latest non-null value passed in.
 *
 * A sheet is told to close by clearing what it shows, but it is still on
 * screen for the length of its exit animation. Reading the cleared value
 * straight away swaps the body for the empty state mid-slide; this keeps
 * showing what was there until the sheet is gone.
 */
export function useLastNonNull<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value != null) last.current = value;
  return value ?? last.current;
}
