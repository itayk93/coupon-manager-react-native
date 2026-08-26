import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_PATH = "auth/callback";
const NATIVE_REDIRECT_URL = `couponmaster://${REDIRECT_PATH}`;

export type SocialProvider = Extract<Provider, "google" | "apple">;

function readOAuthTokens(url: string) {
  const fragment = url.split("#")[1] ?? "";
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  const params = new URLSearchParams(fragment || query);

  const error = params.get("error_description") ?? params.get("error");
  if (error) throw new Error(error);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

async function completeNativeOAuth(url: string | null, redirectTo: string) {
  if (!url) throw new Error("לא התקבל קישור התחברות. נסו שוב.");

  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") return false;
  if (result.type !== "success") throw new Error("ההתחברות לא הושלמה. נסו שוב.");

  const { accessToken, refreshToken } = readOAuthTokens(result.url);
  if (!accessToken || !refreshToken) {
    throw new Error("לא התקבלו פרטי התחברות תקינים. נסו שוב.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return true;
}

export async function signInWithSocialProvider(provider: SocialProvider) {
  const isWeb = Platform.OS === "web";
  const redirectTo = isWeb ? Linking.createURL("login") : NATIVE_REDIRECT_URL;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: !isWeb,
    },
  });

  if (error) throw error;
  if (isWeb) return;
  await completeNativeOAuth(data.url, redirectTo);
}

/** Links another verified provider to the signed-in user instead of creating a second account. */
export async function linkSocialProvider(provider: SocialProvider) {
  const isWeb = Platform.OS === "web";
  const redirectTo = isWeb ? Linking.createURL("profile") : NATIVE_REDIRECT_URL;
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: !isWeb,
    },
  });

  if (error) throw error;
  if (isWeb) return;
  await completeNativeOAuth(data.url, redirectTo);
}
