import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gyvnhvnuidrfmqzielmv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30'
)

async function testarLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'dllogtransporte15@gmail.com',
    password: 'mauricio15'
  })

  console.log('session?', !!data.session)
  console.log('user?', data.user?.email)
  if (error) {
    console.log('error?', error.message)
  } else {
    console.log('Login successful!')
  }
}

testarLogin()
