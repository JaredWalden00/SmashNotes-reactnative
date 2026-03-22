import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

// On web, use Supabase's default localStorage-based storage.
// On native, use AsyncStorage.
const authConfig = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  ...(Platform.OS !== "web" && { storage: AsyncStorage }),
};

export const supabase = createClient(
  supabaseUrl || "https://invalid.local",
  supabaseAnonKey || "invalid",
  { auth: authConfig },
);
