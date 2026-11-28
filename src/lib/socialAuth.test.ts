import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockOpenAuthSessionAsync, mockSignInWithOAuth, mockLinkIdentity, mockSetSession } = vi.hoisted(() => ({
  mockOpenAuthSessionAsync: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockLinkIdentity: vi.fn(),
  mockSetSession: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-linking", () => ({ createURL: vi.fn(() => "https://coupons.itaykarkason.com/onboarding") }));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: mockOpenAuthSessionAsync,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      linkIdentity: mockLinkIdentity,
      setSession: mockSetSession,
    },
  },
}));

import { linkSocialProvider, signInWithSocialProvider } from "./socialAuth";

describe("socialAuth native cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ data: { url: "https://auth.example/oauth" }, error: null });
    mockLinkIdentity.mockResolvedValue({ data: { url: "https://auth.example/link" }, error: null });
    mockSetSession.mockResolvedValue({ error: null });
  });

  it("returns false and does not set a session when OAuth is cancelled", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "cancel" });

    const completed = await signInWithSocialProvider("apple");

    expect(completed).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("returns false when OAuth sheet is dismissed", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "dismiss" });

    const completed = await linkSocialProvider("google");

    expect(completed).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("sets the Supabase session and returns true when OAuth succeeds", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "couponmaster://auth/callback#access_token=tok1&refresh_token=ref1",
    });

    const completed = await signInWithSocialProvider("google");

    expect(completed).toBe(true);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "tok1",
      refresh_token: "ref1",
    });
  });

  it("throws if the redirect callback reports an OAuth error", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "couponmaster://auth/callback#error=access_denied&error_description=User+denied",
    });

    await expect(signInWithSocialProvider("apple")).rejects.toThrow("User denied");
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
