import { Platform } from "react-native";

/**
 * react-native-web has no native animated module, so asking for the native
 * driver there only earns a warning before it falls back to JS anyway.
 */
export const useNativeDriver = Platform.OS !== "web";
