'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  createAnonymousUser: (country?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Skip during SSR/build
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    // Check for classroom student first
    const classroomStudent = localStorage.getItem('current_classroom_student')
    if (classroomStudent) {
      const student = JSON.parse(classroomStudent)
      setUser({
        id: student.id,
        email: student.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_metadata: student.user_metadata
      })
      setLoading(false)
      return
    }

    // Skip if Supabase is not configured
    if (!supabase) {
      console.warn('Supabase not configured - running in demo mode')
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSupabaseUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    if (!supabase) return
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Database error - full error object:', error)
        console.error('Database error - JSON stringified:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('User profile found:', data)
      setUser(data)
    } catch (error: any) {
      console.error('Catch block - full error object:', error)
      console.error('Catch block - JSON stringified:', JSON.stringify(error, null, 2))
      console.error('Catch block - error type:', typeof error)
      console.error('Catch block - error constructor:', error?.constructor?.name)
      
      // The database trigger should have created the profile automatically
      // If it's still failing, it might be a temporary database issue
      // Set loading to false so the user isn't stuck
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      // Demo mode - create a fake user
      const demoUser = {
        id: 'demo-user',
        email,
        country: 'US',
        isAnonymous: false,
        subscription_status: 'free' as const,
        created_at: new Date().toISOString()
      }
      setUser(demoUser)
      return
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      // Demo mode - create a fake user
      const demoUser = {
        id: 'demo-user',
        email,
        country: 'US',
        isAnonymous: false,
        subscription_status: 'free' as const,
        created_at: new Date().toISOString()
      }
      setUser(demoUser)
      return
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    // Clear classroom student if exists
    localStorage.removeItem('current_classroom_student')
    
    if (!supabase) {
      setUser(null)
      return
    }
    
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const createAnonymousUser = async () => {
    // For anonymous users, we'll create a local session
    // This will be implemented in Phase 5 for classroom mode
    throw new Error('Anonymous mode not yet implemented')
  }

  const value = {
    user,
    supabaseUser,
    loading,
    signIn,
    signUp,
    signOut,
    createAnonymousUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}