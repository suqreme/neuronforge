'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/ui/user-menu'
import FlashcardGame from '@/components/games/FlashcardGame'
import { gamificationService } from '@/services/gamificationService'
import { Zap, Brain, Target, Star, Gamepad2, Trophy } from 'lucide-react'

interface Game {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward: number
  estimatedTime: string
  subjects: string[]
}

const games: Game[] = [
  {
    id: 'flashcards',
    name: 'Flashcard Challenge',
    description: 'Test your knowledge with quick-fire flashcard questions',
    icon: <Zap className="w-8 h-8" />,
    difficulty: 'easy',
    xpReward: 50,
    estimatedTime: '5-10 min',
    subjects: ['math', 'english']
  },
  {
    id: 'speed_quiz',
    name: 'Speed Quiz',
    description: 'Answer as many questions as possible in 60 seconds',
    icon: <Target className="w-8 h-8" />,
    difficulty: 'medium',
    xpReward: 75,
    estimatedTime: '2-3 min',
    subjects: ['math', 'english']
  },
  {
    id: 'memory_match',
    name: 'Memory Match',
    description: 'Match concepts with their definitions',
    icon: <Brain className="w-8 h-8" />,
    difficulty: 'medium',
    xpReward: 60,
    estimatedTime: '3-5 min',
    subjects: ['english', 'science']
  },
  {
    id: 'word_builder',
    name: 'Word Builder',
    description: 'Build words from given letters to improve vocabulary',
    icon: <Star className="w-8 h-8" />,
    difficulty: 'hard',
    xpReward: 100,
    estimatedTime: '10-15 min',
    subjects: ['english']
  }
]

export default function GamesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string>('math')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('easy')

  const handleGameComplete = (gameId: string, score: number, correctAnswers: number, totalQuestions: number) => {
    if (!user) return

    // Award XP based on performance
    const game = games.find(g => g.id === gameId)
    if (!game) return

    const baseXP = game.xpReward
    const performanceMultiplier = correctAnswers / totalQuestions
    const xpGained = Math.round(baseXP * performanceMultiplier)

    // Award XP through gamification service
    const result = gamificationService.awardXP(user.id, {
      type: 'review_completed',
      xpGained,
      details: `${game.name}: ${correctAnswers}/${totalQuestions} correct`
    })

    // Update gamification stats
    gamificationService.updateStats(user.id, {
      lessonsCompleted: 1 // Games count as review lessons
    })

    // Show achievements if any
    if (result.newAchievements.length > 0) {
      alert(`🎉 New achievements unlocked! You earned ${xpGained} XP!`)
    }

    setSelectedGame(null)
  }

  const handleStartGame = (gameId: string) => {
    setSelectedGame(gameId)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'hard': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  if (!user) {
    router.push('/')
    return null
  }

  // Render specific game
  if (selectedGame === 'flashcards') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <FlashcardGame 
          subject={selectedSubject}
          difficulty={selectedDifficulty}
          onComplete={(score, correct, total) => handleGameComplete('flashcards', score, correct, total)}
          onExit={() => setSelectedGame(null)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="mb-2"
              >
                ← Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Learning Games</h1>
              <p className="text-muted-foreground">Have fun while learning with interactive mini-games</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={() => router.push('/achievements')}>
                <Trophy className="w-4 h-4 mr-2" />
                View Achievements
              </Button>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Game Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Choose Your Game</h2>
          
          {/* Subject Filter */}
          <div className="flex space-x-4 mb-6">
            <Button 
              variant={selectedSubject === 'math' ? 'default' : 'outline'}
              onClick={() => setSelectedSubject('math')}
            >
              Math
            </Button>
            <Button 
              variant={selectedSubject === 'english' ? 'default' : 'outline'}
              onClick={() => setSelectedSubject('english')}
            >
              English
            </Button>
          </div>
          
          {/* Difficulty Filter */}
          <div className="flex space-x-4 mb-6">
            <Button 
              variant={selectedDifficulty === 'easy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDifficulty('easy')}
            >
              Easy
            </Button>
            <Button 
              variant={selectedDifficulty === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDifficulty('medium')}
            >
              Medium
            </Button>
            <Button 
              variant={selectedDifficulty === 'hard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDifficulty('hard')}
            >
              Hard
            </Button>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games
            .filter(game => game.subjects.includes(selectedSubject))
            .map((game) => (
            <Card key={game.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-primary">
                      {game.icon}
                    </div>
                    <CardTitle className="text-lg">{game.name}</CardTitle>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getDifficultyColor(game.difficulty)}
                  >
                    {game.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{game.description}</p>
                
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Time: </span>
                    <span className="font-medium">{game.estimatedTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reward: </span>
                    <span className="font-medium text-primary">+{game.xpReward} XP</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full"
                  onClick={() => handleStartGame(game.id)}
                  disabled={game.id !== 'flashcards'} // Only flashcards implemented for now
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  {game.id === 'flashcards' ? 'Start Game' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* XP Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <span>How XP Works</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Earn XP</h4>
                <p className="text-muted-foreground">
                  Complete games and answer questions correctly to earn experience points
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Level Up</h4>
                <p className="text-muted-foreground">
                  Accumulate XP to increase your level and unlock new badges
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Unlock Badges</h4>
                <p className="text-muted-foreground">
                  Achieve milestones to earn unique badges and special recognition
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}