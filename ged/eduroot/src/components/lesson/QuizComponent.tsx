'use client'

import { useState } from 'react'

interface QuizQuestion {
  id: number
  question: string
  type: string
  options: string[]
  correct_answer: number
  explanation: string
  points: number
  difficulty: string
}

interface QuizData {
  questions: QuizQuestion[]
  total_points: number
  passing_score: number
  time_estimate: string
}

interface QuizComponentProps {
  quizData: QuizData
  onComplete: (passed: boolean, score: number) => void
}

export default function QuizComponent({ quizData, onComplete }: QuizComponentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)
  const [score, setScore] = useState(0)

  const question = quizData.questions[currentQuestion]

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return

    const newAnswers = [...answers]
    newAnswers[currentQuestion] = selectedAnswer
    setAnswers(newAnswers)
    setShowExplanation(true)
  }

  const handleNextQuestion = () => {
    if (currentQuestion < quizData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowExplanation(false)
    } else {
      completeQuiz()
    }
  }

  const completeQuiz = () => {
    // Calculate score
    let correctAnswers = 0
    quizData.questions.forEach((q, index) => {
      if (answers[index] === q.correct_answer) {
        correctAnswers++
      }
    })

    const finalScore = (correctAnswers / quizData.questions.length) * 100
    const passed = finalScore >= (quizData.passing_score / quizData.total_points) * 100

    setScore(finalScore)
    setQuizComplete(true)
    onComplete(passed, finalScore)
  }

  const retryQuiz = () => {
    setCurrentQuestion(0)
    setAnswers([])
    setSelectedAnswer(null)
    setShowExplanation(false)
    setQuizComplete(false)
    setScore(0)
  }

  if (quizComplete) {
    const passed = score >= (quizData.passing_score / quizData.total_points) * 100
    
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className={`text-6xl mb-6 ${passed ? 'text-green-600' : 'text-orange-600'}`}>
          {passed ? '🎉' : '📚'}
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {passed ? 'Quiz Passed!' : 'Keep Studying!'}
        </h2>
        <p className="text-gray-600 mb-6">
          You scored {Math.round(score)}% on this quiz.
          {passed ? ' Great job!' : ' You need to score higher to pass.'}
        </p>
        
        {/* Score Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {answers.filter((answer, index) => answer === quizData.questions[index].correct_answer).length}
              </div>
              <div className="text-gray-600 text-sm">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {answers.filter((answer, index) => answer !== quizData.questions[index].correct_answer).length}
              </div>
              <div className="text-gray-600 text-sm">Incorrect</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{quizData.questions.length}</div>
              <div className="text-gray-600 text-sm">Total</div>
            </div>
          </div>
        </div>

        <div className="flex space-x-4 justify-center">
          {!passed && (
            <button
              onClick={retryQuiz}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Quiz Header */}
      <div className="p-6 border-b">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Quiz Time!</h2>
          <span className="text-sm text-gray-600">
            Question {currentQuestion + 1} of {quizData.questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / quizData.questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question Content */}
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{question.question}</h3>
          
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showExplanation}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  showExplanation
                    ? index === question.correct_answer
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : selectedAnswer === index
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-300 bg-gray-50 text-gray-500'
                    : selectedAnswer === index
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="font-medium mr-3">
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
                {showExplanation && index === question.correct_answer && (
                  <span className="ml-2 text-green-600">✓</span>
                )}
                {showExplanation && selectedAnswer === index && index !== question.correct_answer && (
                  <span className="ml-2 text-red-600">✗</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">Explanation</h4>
            <p className="text-blue-800">{question.explanation}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {question.difficulty} • {question.points} point{question.points !== 1 ? 's' : ''}
          </div>
          
          <div className="space-x-3">
            {!showExplanation ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
              >
                {currentQuestion === quizData.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}