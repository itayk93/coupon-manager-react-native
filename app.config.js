const app = require("./app.json");

module.exports = {
  ...app.expo,
  extra: {
    ...app.expo.extra,
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    encryptionKey:
      process.env.EXPO_PUBLIC_ENCRYPTION_KEY || process.env.VITE_ENCRYPTION_KEY,
  },
};
