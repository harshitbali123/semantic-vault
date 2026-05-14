const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials:', {
    url: supabaseUrl,
    key: supabaseKey ? 'loaded' : 'missing'
  })
}

// For Node.js 20, we need to provide WebSocket explicitly for realtime
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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

module.exports = supabase