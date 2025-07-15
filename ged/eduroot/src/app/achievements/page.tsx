'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/ui/user-menu'
import { gamificationService } from '@/services/gamificationService'
import { Trophy, Star, Zap, Target, Award, TrendingUp } from 'lucide-react'

export default function AchievementsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [userLevel, setUserLevel] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [recentAchievements, setRecentAchievements] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [activeTab, setActiveTab] = useState<'badges' | 'achievements' | 'stats'>('badges')

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    loadGamificationData()
  }, [user, router])

  const loadGamificationData = () => {
    if (!user) return

    const gamificationData = gamificationService.getUserGamification(user.id)
    const level = gamificationService.calculateLevel(gamificationData.totalXP)
    const badgeProgress = gamificationService.getUserBadgeProgress(user.id)
    const achievements = gamificationService.getRecentAchievements(user.id, 10)

    setUserLevel(level)
    setBadges(badgeProgress)
    setRecentAchievements(achievements)
    setStats(gamificationData.stats)
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500'
      case 'rare': return 'bg-blue-500'
      case 'epic': return 'bg-purple-500'
      case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500'
      default: return 'bg-gray-400'
    }
  }

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-600'
      case 'rare': return 'text-blue-600'
      case 'epic': return 'text-purple-600'
      case 'legendary': return 'text-orange-600'
      default: return 'text-gray-500'
    }
  }

  if (!user) return null

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
              <h1 className="text-2xl font-bold text-foreground">Achievements & Badges</h1>
              <p className="text-muted-foreground">Track your learning progress and earn rewards</p>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* User Level Card */}
        {userLevel && (
          <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Level {userLevel.level}</h2>
                    <p className="text-muted-foreground">
                      {userLevel.currentXP} / {userLevel.currentXP + userLevel.xpToNextLevel} XP
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{userLevel.totalXP}</p>
                  <p className="text-sm text-muted-foreground">Total XP</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress to Level {userLevel.level + 1}</span>
                  <span>{userLevel.xpToNextLevel} XP needed</span>
                </div>
                <Progress 
                  value={(userLevel.currentXP / (userLevel.currentXP + userLevel.xpToNextLevel)) * 100} 
                  className="h-3"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-8">
          <Button 
            variant={activeTab === 'badges' ? 'default' : 'outline'}
            onClick={() => setActiveTab('badges')}
          >
            <Award className="w-4 h-4 mr-2" />
            Badges
          </Button>
          <Button 
            variant={activeTab === 'achievements' ? 'default' : 'outline'}
            onClick={() => setActiveTab('achievements')}
          >
            <Star className="w-4 h-4 mr-2" />
            Recent Achievements
          </Button>
          <Button 
            variant={activeTab === 'stats' ? 'default' : 'outline'}
            onClick={() => setActiveTab('stats')}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Statistics
          </Button>
        </div>

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Badge Collection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {badges.map(({ badge, earned, progress }) => (
                <Card key={badge.id} className={`transition-all hover:shadow-lg ${
                  earned ? 'border-primary bg-primary/5' : 'opacity-75'
                }`}>
                  <CardContent className="p-6">
                    <div className="text-center space-y-3">
                      <div className={`text-6xl ${earned ? '' : 'grayscale'}`}>
                        {badge.icon}
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-lg">{badge.name}</h3>
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                      </div>
                      
                      <Badge 
                        variant="outline" 
                        className={`${getRarityTextColor(badge.rarity)} capitalize`}
                      >
                        {badge.rarity}
                      </Badge>
                      
                      {earned ? (
                        <Badge className="w-full bg-green-500 text-white">
                          ✓ Earned
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {Math.round(progress)}% complete
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Achievements</h2>
            {recentAchievements.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Star className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No achievements yet</h3>
                  <p className="text-muted-foreground">
                    Complete lessons and quizzes to start earning achievements!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {recentAchievements.map((achievement) => {
                  const badge = achievement.badgeId ? gamificationService.getBadgeById(achievement.badgeId) : null
                  
                  return (
                    <Card key={achievement.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="text-3xl">
                            {badge ? badge.icon : '🎉'}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{achievement.title}</h3>
                            <p className="text-sm text-muted-foreground">{achievement.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(achievement.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          {achievement.xpGained > 0 && (
                            <Badge variant="outline" className="text-primary">
                              +{achievement.xpGained} XP
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Learning Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Target className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{stats.lessonsCompleted || 0}</p>
                  <p className="text-sm text-muted-foreground">Lessons Completed</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <Zap className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">{stats.quizzesPassed || 0}</p>
                  <p className="text-sm text-muted-foreground">Quizzes Passed</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">{stats.perfectScores || 0}</p>
                  <p className="text-sm text-muted-foreground">Perfect Scores</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">{stats.currentStreak || 0}</p>
                  <p className="text-sm text-muted-foreground">Current Streak</p>
                </CardContent>
              </Card>
            </div>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Achievement Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Badges Earned</span>
                      <span>{badges.filter(b => b.earned).length} / {badges.length}</span>
                    </div>
                    <Progress value={(badges.filter(b => b.earned).length / badges.length) * 100} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Total Achievements</span>
                      <span>{recentAchievements.length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}