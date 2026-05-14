import { createClient } from '@supabase/supabase-js'

// Anon key — safe to use in frontend
// RLS policies control what this client can access
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)