import { supabase } from "@/integrations/supabase/client";

type ErrorSeverity = "critical" | "warning";

/**
 * Global error reporting for both web and native.
 *
 * Errors are forwarded to the existing `send-emails` Edge Function in
 * `issue_report` mode, so they land in the same inbox as manual reports.
 * Reporting is best-effort: a failed send must never crash the app.
 */
export async function logError(
  source: string,
  error: unknown,
  severity: ErrorSeverity = "warning",
): Promise<void> {
  const details = error instanceof Error
    ? `${error.message}\n\n${error.stack || ""}`
    : String(error);

  try {
    await supabase.functions.invoke("send-emails", {
      body: {
        mode: "issue_report",
        subject: `[auto:${severity}] ${source}`,
        details,
        email: "",
        page_url: typeof window !== "undefined" ? window.location.href : "native",
      },
    });
  } catch {
    // Best-effort: reporting failure must not affect app behavior.
  }
}

export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    void logError("unhandled_promise_rejection", event.reason, "warning");
  });

  window.addEventListener("error", (event) => {
    void logError(
      "uncaught_error",
      event.error ?? event.message,
      "critical",
    );
  });
}
