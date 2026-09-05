import appJson from "./app.json";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default ({ config }: { config: typeof appJson.expo }) => ({
  ...config,
  plugins: [...((config.plugins as string[]) ?? []), "expo-secure-store"],
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }
        : undefined,
    },
  },
  extra: {
    ...config.extra,
    supabaseUrl,
    supabaseAnonKey,
  },
});
