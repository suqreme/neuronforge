'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { RotateCcw, CheckCircle, XCircle, Trophy } from 'lucide-react'

interface FlashcardData {
  id: string
  question: string
  answer: string
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
}

interface FlashcardGameProps {
  subject: string
  difficulty: string
  onComplete: (score: number, correctAnswers: number, totalQuestions: number) => void
  onExit: () => void
}

export default function FlashcardGame({ subject, difficulty, onComplete, onExit }: FlashcardGameProps) {
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [gameComplete, setGameComplete] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  useEffect(() => {
    generateFlashcards()
  }, [subject, difficulty])

  const generateFlashcards = () => {
    // Generate demo flashcards based on subject
    let cards: FlashcardData[] = []
    
    if (subject === 'math') {
      cards = [
        { id: '1', question: 'What is 7 × 8?', answer: '56', subject: 'math', difficulty: 'easy' },
        { id: '2', question: 'What is 15% of 200?', answer: '30', subject: 'math', difficulty: 'medium' },
        { id: '3', question: 'What is the area of a circle with radius 5?', answer: '78.54 (π × 5²)', subject: 'math', difficulty: 'hard' },
        { id: '4', question: 'What is 144 ÷ 12?', answer: '12', subject: 'math', difficulty: 'easy' },
        { id: '5', question: 'Solve: 3x + 7 = 22', answer: 'x = 5', subject: 'math', difficulty: 'medium' }
      ]
    } else {
      cards = [
        { id: '1', question: 'What is a noun?', answer: 'A person, place, or thing', subject: 'english', difficulty: 'easy' },
        { id: '2', question: 'What is the past tense of "run"?', answer: 'Ran', subject: 'english', difficulty: 'easy' },
        { id: '3', question: 'What is alliteration?', answer: 'Repetition of the same consonant sounds', subject: 'english', difficulty: 'medium' },
        { id: '4', question: 'What is a metaphor?', answer: 'A comparison without using "like" or "as"', subject: 'english', difficulty: 'medium' },
        { id: '5', question: 'What is the difference between "your" and "you\'re"?', answer: '"Your" shows possession, "you\'re" means "you are"', subject: 'english', difficulty: 'hard' }
      ]
    }
    
    // Shuffle cards
    const shuffled = cards.sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
  }

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setScore(score + 10)
      setCorrectAnswers(correctAnswers + 1)
      setStreak(streak + 1)
      setBestStreak(Math.max(bestStreak, streak + 1))
    } else {
      setStreak(0)
    }
    
    // Move to next card or complete game
    if (currentIndex + 1 >= flashcards.length) {
      setGameComplete(true)
      onComplete(score + (isCorrect ? 10 : 0), correctAnswers + (isCorrect ? 1 : 0), flashcards.length)
    } else {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
    }
  }

  const resetGame = () => {
    setCurrentIndex(0)
    setShowAnswer(false)
    setScore(0)
    setCorrectAnswers(0)
    setGameComplete(false)
    setStreak(0)
    generateFlashcards()
  }

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  if (flashcards.length === 0) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading flashcards...</p>
        </CardContent>
      </Card>
    )
  }

  if (gameComplete) {
    const percentage = Math.round((correctAnswers / flashcards.length) * 100)
    
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Trophy className="w-16 h-16 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Game Complete!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-2xl font-bold text-primary">{correctAnswers}</p>
              <p className="text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{percentage}%</p>
              <p className="text-muted-foreground">Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{score}</p>
              <p className="text-muted-foreground">Points</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">{bestStreak}</p>
              <p className="text-muted-foreground">Best Streak</p>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <Button onClick={resetGame} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
            <Button variant="outline" onClick={onExit} className="flex-1">
              Exit Game
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            {subject === 'math' ? 'Math' : 'English'} Flashcards
          </CardTitle>
          <Badge variant="outline">
            {currentIndex + 1} / {flashcards.length}
          </Badge>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Bar */}
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Score: </span>
            <span className="font-bold text-primary">{score}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Streak: </span>
            <span className="font-bold text-orange-500">{streak}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Correct: </span>
            <span className="font-bold text-green-500">{correctAnswers}</span>
          </div>
        </div>
        
        {/* Flashcard */}
        <div className="min-h-48 flex items-center justify-center">
          <Card 
            className={`w-full h-40 cursor-pointer transition-transform hover:scale-105 ${
              showAnswer ? 'bg-accent' : 'bg-muted'
            }`}
            onClick={() => setShowAnswer(!showAnswer)}
          >
            <CardContent className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                {!showAnswer ? (
                  <>
                    <p className="text-lg font-medium mb-2">{currentCard.question}</p>
                    <p className="text-sm text-muted-foreground">Click to reveal answer</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-primary mb-2">{currentCard.answer}</p>
                    <Badge variant="outline" className="mb-2">
                      {currentCard.difficulty}
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Answer Buttons */}
        {showAnswer && (
          <div className="flex space-x-4">
            <Button 
              variant="destructive" 
              onClick={() => handleAnswer(false)}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Incorrect
            </Button>
            <Button 
              onClick={() => handleAnswer(true)}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Correct
            </Button>
          </div>
        )}
        
        {!showAnswer && (
          <div className="text-center">
            <Button variant="outline" onClick={onExit}>
              Exit Game
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}