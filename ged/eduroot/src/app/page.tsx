'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import LoginForm from '@/components/auth/LoginForm'
import GradeEstimate from '@/components/auth/GradeEstimate'
import DiagnosticTest from '@/components/auth/DiagnosticTest'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'login' | 'estimate' | 'diagnostic' | 'complete'>('login')
  const [estimatedGrade, setEstimatedGrade] = useState('')
  const [placementLevel, setPlacementLevel] = useState('')
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)

  // Check if user has completed onboarding
  useEffect(() => {
    if (user && !loading) {
      // In demo mode, check localStorage for onboarding completion
      const onboardingComplete = localStorage.getItem(`onboarding_${user.id}`)
      if (onboardingComplete) {
        setHasCompletedOnboarding(true)
        router.push('/dashboard')
      } else {
        setStep('estimate')
      }
    }
  }, [user, loading, router])

  const handleGradeSelected = (grade: string) => {
    setEstimatedGrade(grade)
    setStep('diagnostic')
  }

  const handlePlacementComplete = (level: string) => {
    setPlacementLevel(level)
    setStep('complete')
    
    // Mark onboarding as complete
    if (user) {
      localStorage.setItem(`onboarding_${user.id}`, 'true')
      localStorage.setItem(`placement_${user.id}`, level)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user && step === 'login') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to EduRoot
            </h1>
            <p className="text-xl text-muted-foreground">
              AI-powered learning platform for everyone, everywhere
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/classroom')}
                >
                  Classroom Mode
                </Button>
                <ThemeToggle />
              </div>
              <p className="text-sm text-muted-foreground">
                For shared devices with multiple students
              </p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    )
  }

  // If user is logged in but hasn't completed onboarding, continue with flow
  if (user && step === 'login' && !hasCompletedOnboarding) {
    setStep('estimate')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to EduRoot
          </h1>
          <p className="text-xl text-muted-foreground">
            Let&apos;s find your perfect starting point
          </p>
        </div>

        {step === 'estimate' && (
          <GradeEstimate onGradeSelected={handleGradeSelected} />
        )}

        {step === 'diagnostic' && (
          <DiagnosticTest 
            estimatedGrade={estimatedGrade}
            onPlacementComplete={handlePlacementComplete}
          />
        )}

        {step === 'complete' && (
          <Card className="max-w-md mx-auto">
            <CardContent className="text-center py-8">
              <div className="text-green-500 text-6xl mb-6">🎓</div>
              <CardTitle className="text-2xl mb-4">Ready to Learn!</CardTitle>
              <p className="text-muted-foreground mb-4">
                Based on your diagnostic test, we&apos;ve placed you at <strong className="text-foreground">{placementLevel}</strong> level.
              </p>
              <p className="text-muted-foreground mb-6">
                You can always adjust this later as you progress through your lessons.
              </p>
              <Button
                onClick={() => {
                  // Mark onboarding as complete and navigate to dashboard
                  if (user) {
                    localStorage.setItem(`onboarding_${user.id}`, 'true')
                    localStorage.setItem(`placement_${user.id}`, placementLevel)
                  }
                  router.push('/dashboard')
                }}
                className="w-full"
              >
                Start Learning
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
