import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { Database } from "./types";

const SUPABASE_URL =
  Constants?.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://dugjsiyenazpsoiyduuz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  Constants?.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Z2pzaXllbmF6cHNvaXlkdXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0MTc0MDUsImV4cCI6MjA0NDk5MzQwNX0.CApFJMiOpYTZP3P1Y42maRt9TkrxS3cIqPG3OYMaOfA";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
