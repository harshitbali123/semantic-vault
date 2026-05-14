require('dotenv').config()

console.log('Testing Supabase connection...')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'loaded' : 'missing')

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function test() {
  try {
    console.log('\nAttempting to sign in...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'direct@test.com',
      password: 'Test1234!'
    })

    if (error) {
      console.log('Error from Supabase:', error)
    } else {
      console.log('Success!', data.user.email)
    }
  } catch (err) {
    console.log('Exception:', err.message)
    console.log('Stack:', err.stack)
  }
}

test()
