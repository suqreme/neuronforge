'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import GradeEstimate from '@/components/auth/GradeEstimate'
import DiagnosticTest from '@/components/auth/DiagnosticTest'

export default function Home() {
  const { user, loading } = useAuth()
  const [step, setStep] = useState<'login' | 'estimate' | 'diagnostic' | 'complete'>('login')
  const [estimatedGrade, setEstimatedGrade] = useState('')
  const [placementLevel, setPlacementLevel] = useState('')

  const handleGradeSelected = (grade: string) => {
    setEstimatedGrade(grade)
    setStep('diagnostic')
  }

  const handlePlacementComplete = (level: string) => {
    setPlacementLevel(level)
    setStep('complete')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user && step === 'login') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to EduRoot
            </h1>
            <p className="text-xl text-gray-600">
              AI-powered learning platform for everyone, everywhere
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    )
  }

  if (user && step === 'login') {
    setStep('estimate')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to EduRoot
          </h1>
          <p className="text-xl text-gray-600">
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
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-green-600 text-6xl mb-6">🎓</div>
            <h2 className="text-2xl font-bold mb-4">Ready to Learn!</h2>
            <p className="text-gray-600 mb-4">
              Based on your diagnostic test, we&apos;ve placed you at <strong>{placementLevel}</strong> level.
            </p>
            <p className="text-gray-600 mb-6">
              You can always adjust this later as you progress through your lessons.
            </p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Learning
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
