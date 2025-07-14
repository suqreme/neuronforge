import { createClient } from '@supabase/supabase-js'

// Check if we have valid Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create client if we have real configuration
const hasValidConfig = supabaseUrl && supabaseKey && 
  supabaseUrl !== 'your-supabase-url' && 
  supabaseKey !== 'your-supabase-anon-key'

export const supabase = hasValidConfig 
  ? createClient(supabaseUrl, supabaseKey)
  : null

// For server-side operations
export const createServerClient = () => {
  const serverUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serverUrl || !serverKey || 
      serverUrl === 'your-supabase-url' || 
      serverKey === 'your-supabase-service-role-key') {
    return null
  }
  
  return createClient(serverUrl, serverKey)
}