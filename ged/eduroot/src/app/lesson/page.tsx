'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { curriculumService } from '@/services/curriculumService'
import { progressService } from '@/services/progressService'
import LessonContent from '@/components/lesson/LessonContent'
import QuizComponent from '@/components/lesson/QuizComponent'

interface LessonData {
  lesson: string
  metadata: {
    topic: string
    subtopic: string
    grade_level: string
    subject: string
  }
}

interface QuizData {
  questions: Array<{
    id: number
    question: string
    type: string
    options: string[]
    correct_answer: number
    explanation: string
    points: number
    difficulty: string
  }>
  total_points: number
  passing_score: number
  time_estimate: string
}

function LessonPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const subject = searchParams.get('subject') || ''
  const grade = searchParams.get('grade') || ''
  const topic = searchParams.get('topic') || ''
  const subtopic = searchParams.get('subtopic') || ''

  const [lessonData, setLessonData] = useState<LessonData | null>(null)
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [currentStep, setCurrentStep] = useState<'lesson' | 'quiz' | 'complete'>('lesson')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subtopicInfo, setSubtopicInfo] = useState<any>(null)
  const [lessonStartTime, setLessonStartTime] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    if (subject && grade && topic && subtopic) {
      loadLessonContent()
    }
  }, [user, subject, grade, topic, subtopic, router])

  const loadLessonContent = async () => {
    setLoading(true)
    setError('')

    console.log('Loading lesson with params:', { subject, grade, topic, subtopic })

    try {
      // Get subtopic info from curriculum
      const subtopicData = await curriculumService.getSubtopic(subject, grade, topic, subtopic)
      console.log('Subtopic data:', subtopicData)
      setSubtopicInfo(subtopicData)

      if (!subtopicData) {
        throw new Error(`Subtopic not found: ${subject}/${grade}/${topic}/${subtopic}`)
      }

      // Generate lesson using AI
      const lessonRequest = {
        grade_level: grade.replace('_', ' '),
        subject: subject === 'math' ? 'Mathematics' : 'English Language Arts',
        topic: topic,
        subtopic: subtopic,
        learning_objective: subtopicData.learning_objective,
        estimated_duration: subtopicData.estimated_duration
      }
      
      console.log('Lesson request:', lessonRequest)
      
      const response = await fetch('/api/ai/lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lessonRequest)
      })

      console.log('Lesson response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Lesson API error:', errorText)
        throw new Error(`Failed to generate lesson: ${response.status} - ${errorText}`)
      }

      const lesson = await response.json()
      console.log('Lesson data received:', lesson)
      setLessonData(lesson)
      
      // Track lesson start
      if (user) {
        progressService.startLesson(user.id, subject, grade, topic, subtopic)
        setLessonStartTime(new Date())
      }
    } catch (error) {
      console.error('Error loading lesson:', error)
      
      // Create a fallback lesson for demo purposes
      const fallbackLesson = {
        lesson: `# Welcome to ${subtopic.replace(/_/g, ' ')}!\n\nThis is a demo lesson about ${subtopic.replace(/_/g, ' ')} for ${grade.replace('_', ' ')} level.\n\n## What You'll Learn\n\nIn this lesson, we'll explore the basic concepts and help you understand this topic step by step.\n\n## Let's Get Started!\n\nThis is an interactive lesson that will guide you through the material at your own pace.`,
        metadata: {
          topic: topic,
          subtopic: subtopic,
          grade_level: grade.replace('_', ' '),
          subject: subject === 'math' ? 'Mathematics' : 'English Language Arts'
        }
      }
      
      console.log('Using fallback lesson:', fallbackLesson)
      setLessonData(fallbackLesson)
      
      // Also create minimal subtopic info if missing
      if (!subtopicInfo) {
        setSubtopicInfo({
          name: subtopic.replace(/_/g, ' '),
          learning_objective: `Learn about ${subtopic.replace(/_/g, ' ')}`,
          estimated_duration: '5-10 minutes'
        })
      }
      
      // Track lesson start even with fallback
      if (user) {
        progressService.startLesson(user.id, subject, grade, topic, subtopic)
        setLessonStartTime(new Date())
      }
    } finally {
      setLoading(false)
    }
  }

  const generateQuiz = async () => {
    if (!lessonData || !subtopicInfo) return

    setLoading(true)
    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grade_level: grade.replace('_', ' '),
          subject: subject === 'math' ? 'Mathematics' : 'English Language Arts',
          topic: topic,
          subtopic: subtopic,
          learning_objective: subtopicInfo.learning_objective,
          lesson_summary: lessonData.lesson.substring(0, 500) + '...'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate quiz')
      }

      const quiz = await response.json()
      setQuizData(quiz)
      setCurrentStep('quiz')
    } catch (error) {
      console.error('Error generating quiz:', error)
      setError('Failed to generate quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleQuizComplete = (passed: boolean, score: number) => {
    if (passed) {
      // Calculate time spent
      const timeSpent = lessonStartTime 
        ? Math.round((new Date().getTime() - lessonStartTime.getTime()) / (1000 * 60)) 
        : 0
      
      // Mark lesson as completed
      if (user) {
        progressService.completeLesson(user.id, subject, grade, topic, subtopic, score, timeSpent)
      }
      
      setCurrentStep('complete')
    } else {
      // Allow retry - stay on quiz
      setError('You need to score higher to pass. Please try again!')
    }
  }

  const goToDashboard = () => {
    // Force dashboard refresh to show updated progress
    router.push('/dashboard')
    router.refresh()
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {currentStep === 'lesson' ? 'Generating your lesson...' : 'Creating your quiz...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={goToDashboard}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <button
                onClick={goToDashboard}
                className="text-blue-600 hover:text-blue-500 text-sm mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {subtopicInfo?.name || 'Lesson'}
              </h1>
              <p className="text-gray-600">
                {subject === 'math' ? 'Mathematics' : 'English Language Arts'} • {grade.replace('_', ' ')}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Step {currentStep === 'lesson' ? '1' : currentStep === 'quiz' ? '2' : '3'} of 3
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'lesson' && lessonData && (
          <LessonContent
            lessonData={lessonData}
            onComplete={generateQuiz}
          />
        )}

        {currentStep === 'quiz' && quizData && (
          <QuizComponent
            quizData={quizData}
            onComplete={handleQuizComplete}
          />
        )}

        {currentStep === 'complete' && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-green-600 text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Lesson Complete!</h2>
            <p className="text-gray-600 mb-6">
              Congratulations! You&apos;ve successfully completed the lesson on {subtopicInfo?.name}.
            </p>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={goToDashboard}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                Continue Learning
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function LessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <LessonPageContent />
    </Suspense>
  )
}