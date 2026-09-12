import { describe, expect, it } from "vitest";
import {
  CONNECTION_INTERRUPTED,
  GENERIC_LOGIN_FAILURE,
  isTransportError,
  loginErrorMessage,
} from "./authErrors";

describe("isTransportError", () => {
  it("recognises the supabase-js error for a request that never completed", () => {
    const error = Object.assign(new Error("Failed to send a request to the Edge Function"), {
      name: "FunctionsFetchError",
    });
    expect(isTransportError(error)).toBe(true);
  });

  it("recognises the browser and native wordings for the same thing", () => {
    for (const message of [
      "Failed to fetch",
      "Network request failed",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ]) {
      expect(isTransportError(new Error(message))).toBe(true);
    }
  });

  it("does not mistake a refusal for a dropped connection", () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
    });
    expect(isTransportError(error)).toBe(false);
    expect(isTransportError(new Error("אימייל או סיסמה שגויים."))).toBe(false);
  });
});

describe("loginErrorMessage", () => {
  it("prefers what the server actually said", () => {
    const error = Object.assign(new Error("Failed to send a request to the Edge Function"), {
      name: "FunctionsFetchError",
    });
    expect(loginErrorMessage(error, "אימייל או סיסמה שגויים.")).toBe("אימייל או סיסמה שגויים.");
    expect(loginErrorMessage(error, "   ")).toBe(CONNECTION_INTERRUPTED);
  });

  it("explains a dropped connection in Hebrew, and says to retry", () => {
    const error = Object.assign(new Error("Failed to send a request to the Edge Function"), {
      name: "FunctionsFetchError",
    });
    expect(loginErrorMessage(error)).toBe(CONNECTION_INTERRUPTED);
  });

  it("passes through any other message it is given", () => {
    expect(loginErrorMessage(new Error("יותר מדי נסיונות"))).toBe("יותר מדי נסיונות");
  });

  it("falls back when there is nothing to show", () => {
    expect(loginErrorMessage(null)).toBe(GENERIC_LOGIN_FAILURE);
    expect(loginErrorMessage({})).toBe(GENERIC_LOGIN_FAILURE);
    expect(loginErrorMessage(new Error("  "))).toBe(GENERIC_LOGIN_FAILURE);
  });
});
