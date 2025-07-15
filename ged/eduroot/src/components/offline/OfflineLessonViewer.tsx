'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { offlineService } from '@/services/offlineService'
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  WifiOff,
  Clock,
  Target,
  Star
} from 'lucide-react'

interface OfflineLessonViewerProps {
  lessonId: string
  onComplete: (score: number) => void
  onExit: () => void
}

export default function OfflineLessonViewer({ lessonId, onComplete, onExit }: OfflineLessonViewerProps) {
  const [lesson, setLesson] = useState<any>(null)
  const [currentMode, setCurrentMode] = useState<'lesson' | 'quiz'>('lesson')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [showResult, setShowResult] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    loadLesson()
  }, [lessonId])

  const loadLesson = () => {
    const downloadedLessons = offlineService.getDownloadedLessons()
    const foundLesson = downloadedLessons.find(l => l.id === lessonId)
    if (foundLesson) {
      setLesson(foundLesson)
    }
  }

  const handleStartQuiz = () => {
    setCurrentMode('quiz')
    setCurrentQuestion(0)
    setAnswers([])
    setScore(0)
    setQuizComplete(false)
  }

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  const handleNextQuestion = () => {
    if (selectedAnswer === null) return

    const newAnswers = [...answers, selectedAnswer]
    setAnswers(newAnswers)
    
    if (currentQuestion + 1 < lesson.quiz.questions.length) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      // Quiz complete
      const finalScore = calculateScore(newAnswers)
      setScore(finalScore)
      setQuizComplete(true)
      onComplete(finalScore)
    }
  }

  const calculateScore = (userAnswers: number[]): number => {
    let correct = 0
    lesson.quiz.questions.forEach((question: any, index: number) => {
      if (userAnswers[index] === question.correct) {
        correct++
      }
    })
    return Math.round((correct / lesson.quiz.questions.length) * 100)
  }

  const handleShowResult = () => {
    setShowResult(true)
  }

  const restartQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setAnswers([])
    setScore(0)
    setQuizComplete(false)
    setShowResult(false)
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Lesson Not Found</h3>
            <p className="text-muted-foreground mb-4">
              This lesson is not available offline. Please download it first.
            </p>
            <Button onClick={onExit}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentMode === 'lesson') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" onClick={onExit}>
                  ← Back
                </Button>
                <WifiOff className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  Offline Mode
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{lesson.estimatedTime}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Lesson Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{lesson.title}</CardTitle>
                    <p className="text-muted-foreground capitalize">
                      {lesson.subject} • {lesson.topic} • {lesson.subtopic}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="capitalize">
                      {lesson.language}
                    </Badge>
                    <Badge variant="outline">
                      {lesson.difficulty || 'Beginner'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Lesson Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Lesson Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-base leading-7 text-foreground">
                    {lesson.content}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quiz Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Practice Quiz</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Test your understanding with {lesson.quiz.questions.length} questions
                  </p>
                  <Button onClick={handleStartQuiz} className="w-full">
                    Start Quiz
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  if (quizComplete) {
    const percentage = score
    const passed = percentage >= 70
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {passed ? (
                <CheckCircle className="w-16 h-16 text-green-500" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {passed ? 'Quiz Completed!' : 'Quiz Complete'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: passed ? '#22c55e' : '#ef4444' }}>
                  {percentage}%
                </div>
                <p className="text-muted-foreground">
                  {answers.filter((answer, index) => answer === lesson.quiz.questions[index].correct).length} out of {lesson.quiz.questions.length} correct
                </p>
              </div>
              
              <div className="flex justify-center">
                <Badge variant={passed ? 'default' : 'destructive'} className="px-4 py-2">
                  {passed ? 'Passed' : 'Needs Improvement'}
                </Badge>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <Button onClick={restartQuiz} variant="outline" className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Quiz
              </Button>
              <Button onClick={onExit} className="flex-1">
                Continue Learning
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Quiz Mode
  const currentQ = lesson.quiz.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / lesson.quiz.questions.length) * 100

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onExit}>
                ← Exit Quiz
              </Button>
              <WifiOff className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline" className="text-xs">
                Offline Quiz
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                Question {currentQuestion + 1} of {lesson.quiz.questions.length}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quiz Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Question */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{currentQ.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentQ.options.map((option: string, index: number) => (
                  <Button
                    key={index}
                    variant={selectedAnswer === index ? "default" : "outline"}
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => handleAnswerSelect(index)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span>{option}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Answer Result */}
          {showResult && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    {selectedAnswer === currentQ.correct ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-semibold">
                      {selectedAnswer === currentQ.correct ? 'Correct!' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentQ.explanation}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onExit}>
              Exit Quiz
            </Button>
            <div className="space-x-2">
              {!showResult && selectedAnswer !== null && (
                <Button onClick={handleShowResult}>
                  Show Answer
                </Button>
              )}
              {showResult && (
                <Button onClick={handleNextQuestion}>
                  {currentQuestion + 1 < lesson.quiz.questions.length ? 'Next Question' : 'Finish Quiz'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}