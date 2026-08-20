import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_PATH = "auth/callback";

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

export async function signInWithSocialProvider(provider: Extract<Provider, "google" | "apple">) {
  const isWeb = Platform.OS === "web";
  const redirectTo = Linking.createURL(isWeb ? "login" : REDIRECT_PATH);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: !isWeb,
    },
  });

  if (error) throw error;
  if (isWeb) return;
  if (!data.url) throw new Error("לא התקבל קישור התחברות. נסו שוב.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") return;
  if (result.type !== "success") throw new Error("ההתחברות לא הושלמה. נסו שוב.");

  const { accessToken, refreshToken } = readOAuthTokens(result.url);
  if (!accessToken || !refreshToken) {
    throw new Error("לא התקבלו פרטי התחברות תקינים. נסו שוב.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}
