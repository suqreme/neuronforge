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

// Database types
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          role: 'student' | 'teacher' | 'admin'
          country: string | null
          placement_level: string | null
          subscription_plan: 'free' | 'basic' | 'premium'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: 'student' | 'teacher' | 'admin'
          country?: string | null
          placement_level?: string | null
          subscription_plan?: 'free' | 'basic' | 'premium'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: 'student' | 'teacher' | 'admin'
          country?: string | null
          placement_level?: string | null
          subscription_plan?: 'free' | 'basic' | 'premium'
          created_at?: string
          updated_at?: string
        }
      }
      user_progress: {
        Row: {
          id: string
          user_id: string
          subject: string
          grade_level: string
          topic: string
          subtopic: string
          status: 'locked' | 'unlocked' | 'in_progress' | 'completed'
          score: number
          attempts: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          grade_level: string
          topic: string
          subtopic: string
          status?: 'locked' | 'unlocked' | 'in_progress' | 'completed'
          score?: number
          attempts?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          grade_level?: string
          topic?: string
          subtopic?: string
          status?: 'locked' | 'unlocked' | 'in_progress' | 'completed'
          score?: number
          attempts?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          user_id: string
          subject: string
          grade_level: string
          topic: string
          subtopic: string
          content: string
          quiz_data: any
          ai_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          grade_level: string
          topic: string
          subtopic: string
          content: string
          quiz_data?: any
          ai_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          grade_level?: string
          topic?: string
          subtopic?: string
          content?: string
          quiz_data?: any
          ai_notes?: string | null
          created_at?: string
        }
      }
      user_gamification: {
        Row: {
          id: string
          user_id: string
          level: number
          total_xp: number
          earned_badges: any
          achievements: any
          stats: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level?: number
          total_xp?: number
          earned_badges?: any
          achievements?: any
          stats?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level?: number
          total_xp?: number
          earned_badges?: any
          achievements?: any
          stats?: any
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}