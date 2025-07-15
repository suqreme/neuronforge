'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  grade: string
  subject: string
}

interface DiagnosticTestProps {
  estimatedGrade: string
  onPlacementComplete: (placementLevel: string) => void
}

export default function DiagnosticTest({ estimatedGrade, onPlacementComplete }: DiagnosticTestProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Preparing your diagnostic test...')
  const [testComplete, setTestComplete] = useState(false)

  const { user } = useAuth()

  const loadFallbackQuestions = () => {
    const sampleQuestions: QuizQuestion[] = [
      {
        question: "What is 2 + 3?",
        options: ["4", "5", "6", "7"],
        correct: 1,
        grade: "1st Grade",
        subject: "Mathematics"
      },
      {
        question: "What is 10 - 4?",
        options: ["5", "6", "7", "8"],
        correct: 1,
        grade: "1st Grade",
        subject: "Mathematics"
      },
      {
        question: "What is 3 × 4?",
        options: ["10", "11", "12", "13"],
        correct: 2,
        grade: "2nd Grade",
        subject: "Mathematics"
      },
      {
        question: "What is 15 ÷ 3?",
        options: ["4", "5", "6", "7"],
        correct: 1,
        grade: "2nd Grade",
        subject: "Mathematics"
      },
      {
        question: "What is 25% of 100?",
        options: ["20", "25", "30", "35"],
        correct: 1,
        grade: "3rd Grade",
        subject: "Mathematics"
      }
    ]
    
    setQuestions(sampleQuestions)
    setLoading(false)
  }

  const generateDiagnosticQuestions = useCallback(async () => {
    setLoading(true)
    setLoadingMessage('Preparing your diagnostic test...')
    
    try {
      // Check if we have cached questions first
      const cacheKey = `diagnostic_${estimatedGrade}_math`
      const cachedQuestions = localStorage.getItem(cacheKey)
      
      if (cachedQuestions) {
        const parsed = JSON.parse(cachedQuestions)
        setQuestions(parsed)
        setLoading(false)
        return
      }

      // Set up timeout for faster fallback
      const timeoutId = setTimeout(() => {
        setLoadingMessage('This is taking longer than expected. Loading backup questions...')
        // If API is slow, load fallback questions after 8 seconds
        setTimeout(() => {
          console.log('API timeout, loading fallback questions')
          loadFallbackQuestions()
        }, 3000)
      }, 5000)

      // Call the diagnostic API route
      const response = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          estimatedGrade: estimatedGrade,
          subject: 'math'
        })
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const testData = await response.json()
      
      // Convert AI response to our format
      const aiQuestions: QuizQuestion[] = testData.diagnostic?.questions?.map((q: any) => ({
        question: q.question,
        options: q.options,
        correct: q.correct,
        grade: q.gradeLevel || estimatedGrade,
        subject: 'Mathematics'
      })) || []

      if (aiQuestions.length > 0) {
        setQuestions(aiQuestions)
        // Cache the questions for faster future loads
        localStorage.setItem(cacheKey, JSON.stringify(aiQuestions))
      } else {
        // Fallback to hardcoded questions if AI fails
        throw new Error('No questions generated')
      }
    } catch (error) {
      console.error('Failed to generate AI questions, using fallback:', error)
      
      // Fallback questions
      const sampleQuestions: QuizQuestion[] = [
        {
          question: "What is 2 + 3?",
          options: ["4", "5", "6", "7"],
          correct: 1,
          grade: "1st Grade",
          subject: "Mathematics"
        },
        {
          question: "How many letters are in the word 'cat'?",
          options: ["2", "3", "4", "5"],
          correct: 1,
          grade: "1st Grade", 
          subject: "English Language Arts"
        },
        {
          question: "What is 15 - 8?",
          options: ["6", "7", "8", "9"],
          correct: 1,
          grade: "2nd Grade",
          subject: "Mathematics"
        },
        {
          question: "Which word rhymes with 'cat'?",
          options: ["dog", "hat", "run", "big"],
          correct: 1,
          grade: "2nd Grade",
          subject: "English Language Arts"
        },
        {
          question: "What is 6 × 4?",
          options: ["20", "22", "24", "26"],
          correct: 2,
          grade: "3rd Grade",
          subject: "Mathematics"
        }
      ]
      setQuestions(sampleQuestions)
    }
    
    setLoading(false)
  }, [estimatedGrade])

  useEffect(() => {
    generateDiagnosticQuestions()
  }, [generateDiagnosticQuestions])

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  const handleNextQuestion = () => {
    if (selectedAnswer !== null) {
      const newAnswers = [...answers, selectedAnswer]
      setAnswers(newAnswers)
      
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1)
        setSelectedAnswer(null)
      } else {
        completeTest(newAnswers)
      }
    }
  }

  const completeTest = async (finalAnswers: number[]) => {
    setTestComplete(true)
    
    // Calculate placement level based on answers

    // Simple placement logic - find the lowest grade where they got questions wrong
    let placementLevel = "Kindergarten"
    const gradeOrder = ["Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade"]
    
    for (let i = 0; i < questions.length; i++) {
      if (finalAnswers[i] === questions[i].correct) {
        const gradeIndex = gradeOrder.indexOf(questions[i].grade)
        if (gradeIndex > gradeOrder.indexOf(placementLevel)) {
          placementLevel = questions[i].grade
        }
      } else {
        // If they got this wrong, place them at the previous grade
        const gradeIndex = gradeOrder.indexOf(questions[i].grade)
        if (gradeIndex > 0) {
          placementLevel = gradeOrder[gradeIndex - 1]
        }
        break
      }
    }

    // Save placement to database
    if (user && supabase) {
      await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          placement_level: placementLevel,
          total_xp: 0,
          badges: []
        })
    }

    // Auto-redirect after 3 seconds
    setTimeout(() => {
      onPlacementComplete(placementLevel)
    }, 3000)
  }

  if (loading) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{loadingMessage}</p>
          <div className="mt-4 text-sm text-muted-foreground space-y-1">
            <p>• Creating personalized questions for {estimatedGrade}</p>
            <p>• Analyzing your learning level</p>
            <p>• Setting up your diagnostic test</p>
          </div>
          <div className="mt-6">
            <Button
              variant="link"
              onClick={loadFallbackQuestions}
              className="text-sm"
            >
              Skip AI generation and use standard test
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (testComplete) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <div className="text-green-500 text-4xl mb-4">✓</div>
          <CardTitle className="text-2xl mb-4">Test Complete!</CardTitle>
          <p className="text-muted-foreground mb-6">
            We&apos;re analyzing your results and setting up your personalized learning path...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Redirecting in a few seconds...
          </p>
        </CardContent>
      </Card>
    )
  }

  const question = questions[currentQuestion]
  const progressValue = ((currentQuestion + 1) / questions.length) * 100

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {question.grade} {question.subject}
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </CardHeader>

      <CardContent>
        <CardTitle className="text-lg font-medium mb-6">{question.question}</CardTitle>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={`w-full text-left p-3 border transition-colors ${
                selectedAnswer === index
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <Button
          onClick={handleNextQuestion}
          disabled={selectedAnswer === null}
          className="w-full"
        >
          {currentQuestion === questions.length - 1 ? 'Complete Test' : 'Next Question'}
        </Button>
      </CardContent>
    </Card>
  )
}