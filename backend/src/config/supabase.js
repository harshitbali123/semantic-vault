const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials:', {
    url: supabaseUrl,
    anonKey: supabaseAnonKey ? 'loaded' : 'missing'
  })
}

if (!supabaseServiceRoleKey) {
  console.warn('Supabase service role key is missing; admin auth operations will fail')
}

// For Node.js 20, we need to provide WebSocket explicitly for realtime
const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      headers: {
        'X-Client-Info': 'supabase-js/web'
      }
    },
    realtime: {
      transport: WebSocket
    }
  }
)

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: WebSocket
    }
  }
)

module.exports = {
  supabase,
  supabaseAdmin
}