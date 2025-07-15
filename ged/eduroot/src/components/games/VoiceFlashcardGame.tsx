'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { voiceService } from '@/services/voiceService'
import { RotateCcw, CheckCircle, XCircle, Trophy, Volume2, Play, Pause, VolumeX } from 'lucide-react'

interface VoiceFlashcardData {
  id: string
  question: string
  answer: string
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  audioHint?: string
}

interface VoiceFlashcardGameProps {
  subject: string
  difficulty: string
  onComplete: (score: number, correctAnswers: number, totalQuestions: number) => void
  onExit: () => void
}

export default function VoiceFlashcardGame({ subject, difficulty, onComplete, onExit }: VoiceFlashcardGameProps) {
  const [flashcards, setFlashcards] = useState<VoiceFlashcardData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [gameComplete, setGameComplete] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)

  useEffect(() => {
    generateFlashcards()
    setIsVoiceSupported(voiceService.isVoiceSupported())
  }, [subject, difficulty])

  useEffect(() => {
    // Auto-play question when card changes
    if (autoPlay && isVoiceSupported && flashcards.length > 0 && currentIndex < flashcards.length) {
      const currentCard = flashcards[currentIndex]
      if (currentCard && !showAnswer) {
        setTimeout(() => {
          readQuestion(currentCard.question)
        }, 500)
      }
    }
  }, [currentIndex, showAnswer, autoPlay, isVoiceSupported, flashcards])

  const generateFlashcards = () => {
    let cards: VoiceFlashcardData[] = []
    
    if (subject === 'math') {
      cards = [
        { 
          id: '1', 
          question: 'What is 7 times 8?', 
          answer: '56', 
          subject: 'math', 
          difficulty: 'easy',
          audioHint: 'Think about counting by 7s eight times'
        },
        { 
          id: '2', 
          question: 'What is 15 percent of 200?', 
          answer: '30', 
          subject: 'math', 
          difficulty: 'medium',
          audioHint: 'Remember: percent means out of 100'
        },
        { 
          id: '3', 
          question: 'What is the area of a circle with radius 5?', 
          answer: '78.54 or pi times 5 squared', 
          subject: 'math', 
          difficulty: 'hard',
          audioHint: 'Use the formula: pi times radius squared'
        },
        { 
          id: '4', 
          question: 'What is 144 divided by 12?', 
          answer: '12', 
          subject: 'math', 
          difficulty: 'easy',
          audioHint: 'Think about how many 12s fit into 144'
        },
        { 
          id: '5', 
          question: 'Solve: 3x plus 7 equals 22', 
          answer: 'x equals 5', 
          subject: 'math', 
          difficulty: 'medium',
          audioHint: 'First subtract 7 from both sides'
        }
      ]
    } else {
      cards = [
        { 
          id: '1', 
          question: 'What is a noun?', 
          answer: 'A person, place, or thing', 
          subject: 'english', 
          difficulty: 'easy',
          audioHint: 'Think about words that name something'
        },
        { 
          id: '2', 
          question: 'What is the past tense of run?', 
          answer: 'Ran', 
          subject: 'english', 
          difficulty: 'easy',
          audioHint: 'Think about yesterday: I ran to school'
        },
        { 
          id: '3', 
          question: 'What is alliteration?', 
          answer: 'Repetition of the same consonant sounds', 
          subject: 'english', 
          difficulty: 'medium',
          audioHint: 'Think about Peter Piper picked peppers'
        },
        { 
          id: '4', 
          question: 'What is a metaphor?', 
          answer: 'A comparison without using like or as', 
          subject: 'english', 
          difficulty: 'medium',
          audioHint: 'Different from simile which uses like or as'
        },
        { 
          id: '5', 
          question: 'What is the difference between your and you are?', 
          answer: 'Your shows possession, you are means you are', 
          subject: 'english', 
          difficulty: 'hard',
          audioHint: 'Your shows ownership, you are can be shortened to you\'re'
        }
      ]
    }
    
    const shuffled = cards.sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
  }

  const readQuestion = async (text: string) => {
    if (!isVoiceSupported) return
    
    setIsPlaying(true)
    try {
      await voiceService.speak({
        text,
        rate: 0.9,
        pitch: 1.1,
        volume: 0.9,
        onEnd: () => setIsPlaying(false)
      })
    } catch (error) {
      console.error('Voice error:', error)
      setIsPlaying(false)
    }
  }

  const readAnswer = async (text: string) => {
    if (!isVoiceSupported) return
    
    setIsPlaying(true)
    try {
      await voiceService.speak({
        text: `The answer is: ${text}`,
        rate: 0.8,
        pitch: 1.0,
        volume: 0.9,
        onEnd: () => setIsPlaying(false)
      })
    } catch (error) {
      console.error('Voice error:', error)
      setIsPlaying(false)
    }
  }

  const readHint = async (hint: string) => {
    if (!isVoiceSupported || !hint) return
    
    setIsPlaying(true)
    try {
      await voiceService.speak({
        text: `Hint: ${hint}`,
        rate: 0.9,
        pitch: 1.2,
        volume: 0.9,
        onEnd: () => setIsPlaying(false)
      })
    } catch (error) {
      console.error('Voice error:', error)
      setIsPlaying(false)
    }
  }

  const stopSpeaking = () => {
    voiceService.stop()
    setIsPlaying(false)
  }

  const handleCardClick = () => {
    if (showAnswer) return
    
    setShowAnswer(true)
    const currentCard = flashcards[currentIndex]
    if (currentCard && autoPlay) {
      setTimeout(() => {
        readAnswer(currentCard.answer)
      }, 300)
    }
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
        {/* Voice Controls */}
        {isVoiceSupported && (
          <div className="flex items-center justify-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => readQuestion(currentCard.question)}
              disabled={isPlaying}
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopSpeaking}
              disabled={!isPlaying}
            >
              <VolumeX className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoPlay(!autoPlay)}
              className={autoPlay ? 'bg-primary/10' : ''}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
            {currentCard.audioHint && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => readHint(currentCard.audioHint!)}
                disabled={isPlaying}
              >
                💡
              </Button>
            )}
          </div>
        )}

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
            onClick={handleCardClick}
          >
            <CardContent className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                {!showAnswer ? (
                  <>
                    <p className="text-lg font-medium mb-2">{currentCard.question}</p>
                    <p className="text-sm text-muted-foreground">
                      {isVoiceSupported ? 'Click to reveal answer or use voice controls' : 'Click to reveal answer'}
                    </p>
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