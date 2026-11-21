import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase publishable keys are designed for use in client applications.
// Row-level security is enabled on all user-facing tables and Storage objects.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pnnndxccktgngrlbzscy.supabase.co';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vqDidOOCNaplDnyle0_hQg_ZF5B-Jwe';

export const supabase = createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
export const isSupabaseConfigured = Boolean(url && key);
