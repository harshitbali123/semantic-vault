require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seed() {
  console.log('Seeding test user...')

  // Create test user
  const { data, error } =
    await supabase.auth.admin.createUser({
      email: 'dev@test.com',
      password: 'DevPassword123!',
      email_confirm: true
    })

  if (
    error &&
    error.message.includes('already registered')
  ) {
    console.log('Test user already exists — skipping')
    return
  }

  if (error) throw error

  console.log('Test user created:', data.user.email)
  console.log('Email: dev@test.com')
  console.log('Password: DevPassword123!')
  console.log('Done!')
}

seed().catch(console.error)