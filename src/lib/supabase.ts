import { createClient } from '@supabase/supabase-js';

// Using the exact URL and Key provided to prevent environment variable parsing errors
const supabaseUrl = 'https://ipmtnzsdgbtibaekaldj.supabase.co';
const supabaseAnonKey = 'sb_publishable_H72nNULFf9vv5xizJN-MyA_LbwthET-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = true;


