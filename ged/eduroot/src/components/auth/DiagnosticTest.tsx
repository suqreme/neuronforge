'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

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
  const [testComplete, setTestComplete] = useState(false)

  const { user } = useAuth()

  const generateDiagnosticQuestions = useCallback(async () => {
    setLoading(true)
    
    try {
      // Call the diagnostic API route
      const response = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimated_grade: estimatedGrade,
          subject: 'Mathematics', // Start with math, could expand to include ELA
          target_topics: ['counting', 'addition_subtraction', 'place_value']
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const testData = await response.json()
      
      // Convert AI response to our format
      const aiQuestions: QuizQuestion[] = testData.questions?.map((q: { question: string; options: string[]; correct_answer: number; grade_level?: string }) => ({
        question: q.question,
        options: q.options,
        correct: q.correct_answer,
        grade: q.grade_level || estimatedGrade,
        subject: 'Mathematics'
      })) || []

      if (aiQuestions.length > 0) {
        setQuestions(aiQuestions)
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

    onPlacementComplete(placementLevel)
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Preparing your diagnostic test...</p>
        </div>
      </div>
    )
  }

  if (testComplete) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-4">Test Complete!</h2>
          <p className="text-gray-600">
            We&apos;re analyzing your results and setting up your personalized learning path...
          </p>
        </div>
      </div>
    )
  }

  const question = questions[currentQuestion]

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-600">
            {question.grade} {question.subject}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <h3 className="text-lg font-medium mb-6">{question.question}</h3>

      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelect(index)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedAnswer === index
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        onClick={handleNextQuestion}
        disabled={selectedAnswer === null}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {currentQuestion === questions.length - 1 ? 'Complete Test' : 'Next Question'}
      </button>
    </div>
  )
}