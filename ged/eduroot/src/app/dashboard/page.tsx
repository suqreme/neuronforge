'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { curriculumService } from '@/services/curriculumService'
import { progressService } from '@/services/progressService'
import { subscriptionService } from '@/services/subscriptionService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/ui/user-menu'

interface CurriculumTopic {
  id: string
  name: string
  subtopics: Array<{
    id: string
    name: string
    unlocked: boolean
    completed: boolean
  }>
}

interface UserStats {
  lessonsCompleted: number
  quizzesPassed: number
  totalXP: number
  currentStreak: number
  lastLessonDate: string
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState('math')
  const [topics, setTopics] = useState<CurriculumTopic[]>([])
  const [currentGrade, setCurrentGrade] = useState('grade_1')
  const [userPlacement, setUserPlacement] = useState('')
  const [userStats, setUserStats] = useState<UserStats>({
    lessonsCompleted: 0,
    quizzesPassed: 0,
    totalXP: 0,
    currentStreak: 0,
    lastLessonDate: ''
  })
  const [lastLesson, setLastLesson] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    loadSubjects()
    
    // Load user's placement level and progress
    if (user) {
      const placement = localStorage.getItem(`placement_${user.id}`)
      if (placement) {
        setUserPlacement(placement)
        // Convert placement to grade format
        const gradeMap: Record<string, string> = {
          'Kindergarten': 'kindergarten',
          '1st Grade': 'grade_1',
          '2nd Grade': 'grade_2',
          '3rd Grade': 'grade_3'
        }
        const mappedGrade = gradeMap[placement]
        if (mappedGrade) {
          setCurrentGrade(mappedGrade)
        }
      }
      
      // Load user stats, last lesson, and subscription
      loadUserProgress()
      loadSubscriptionInfo()
    }
  }, [user])

  useEffect(() => {
    if (selectedSubject) {
      loadCurriculum()
    }
  }, [selectedSubject, currentGrade])

  const loadSubjects = async () => {
    try {
      const subjectList = await curriculumService.getAllSubjects()
      setSubjects(subjectList)
    } catch (error) {
      console.error('Failed to load subjects:', error)
    }
  }

  const loadUserProgress = () => {
    if (!user) return
    
    const stats = progressService.getUserStats(user.id)
    setUserStats(stats)
    
    const lastLessonData = progressService.getLastLesson(user.id)
    setLastLesson(lastLessonData)
  }

  const loadSubscriptionInfo = () => {
    if (!user) return
    
    const subscriptionData = subscriptionService.getUserSubscription(user.id)
    setSubscription(subscriptionData)
  }

  const loadCurriculum = async () => {
    try {
      const curriculum = await curriculumService.getUserPath(selectedSubject, currentGrade, user?.id)
      setTopics(curriculum.topics)
    } catch (error) {
      console.error('Failed to load curriculum:', error)
    }
  }

  const startLesson = (topicId: string, subtopicId: string) => {
    console.log('Starting lesson with:', { selectedSubject, currentGrade, topicId, subtopicId })
    router.push(`/lesson?subject=${selectedSubject}&grade=${currentGrade}&topic=${topicId}&subtopic=${subtopicId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your learning dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">EduRoot Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {user.email}! 
                {userPlacement && <span className="ml-2 text-primary">• Placed at {userPlacement}</span>}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                Level: {currentGrade.replace('_', ' ')}
              </Badge>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => router.push('/subscription')}
              >
                Upgrade
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => router.push('/impact')}
              >
                🗺️ Impact Map
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => router.push('/games')}
              >
                Games
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => router.push('/achievements')}
              >
                Achievements
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => router.push('/offline')}
              >
                Offline Learning
              </Button>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subject Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Choose Your Subject</h2>
          <div className="flex space-x-4">
            {subjects.map((subject) => (
              <Button
                key={subject}
                variant={selectedSubject === subject ? 'default' : 'outline'}
                onClick={() => setSelectedSubject(subject)}
                className="px-6 py-3"
              >
                {subject === 'math' ? 'Mathematics' : 'English Language Arts'}
              </Button>
            ))}
          </div>
        </div>

        {/* Grade Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Current Grade Level</h2>
          <select
            value={currentGrade}
            onChange={(e) => setCurrentGrade(e.target.value)}
            className="px-4 py-2 border border-input bg-background text-foreground focus:ring-ring focus:border-ring"
          >
            <option value="kindergarten">Kindergarten</option>
            <option value="grade_1">1st Grade</option>
            <option value="grade_2">2nd Grade</option>
            <option value="grade_3">3rd Grade</option>
          </select>
        </div>

        {/* Continue Learning Section */}
        {lastLesson && (
          <Card className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-2">Continue Learning</h2>
              <p className="mb-4">
                Resume your lesson: <span className="font-semibold">{lastLesson.subtopic.replace(/_/g, ' ')}</span>
              </p>
              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  onClick={() => startLesson(lastLesson.topic, lastLesson.subtopic)}
                >
                  {lastLesson.completed ? 'Review Lesson' : 'Continue Lesson'}
                </Button>
                {lastLesson.completed && (
                  <Badge variant="secondary" className="bg-green-500 text-white">
                    ✅ Completed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Learning Path */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Your Learning Path</h2>
          
          {topics.map((topic) => (
            <Card key={topic.id}>
              <CardHeader>
                <CardTitle>{topic.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topic.subtopics.map((subtopic) => (
                    <Card
                      key={subtopic.id}
                      className={`transition-colors ${
                        subtopic.completed
                          ? 'border-green-500/50 bg-green-50/50'
                          : subtopic.unlocked
                          ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
                          : 'border-muted bg-muted/30'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-foreground">{subtopic.name}</h4>
                          {subtopic.completed && (
                            <Badge variant="secondary" className="bg-green-500 text-white">
                              ✅ Complete
                            </Badge>
                          )}
                        </div>
                        
                        {subtopic.unlocked ? (
                          <Button
                            onClick={() => startLesson(topic.id, subtopic.id)}
                            className="w-full"
                            variant={subtopic.completed ? "secondary" : "default"}
                          >
                            {subtopic.completed ? 'Review Lesson' : 'Start Lesson'}
                          </Button>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            🔒 Complete previous lessons to unlock
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Subscription Status */}
        {subscription && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your Plan</span>
                <Badge variant={subscription.plan === 'free' ? 'secondary' : 'default'}>
                  {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {subscription.features.dailyLessonLimit || '∞'}
                  </div>
                  <div className="text-sm text-muted-foreground">Daily Lessons</div>
                  {subscription.features.dailyLessonLimit && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {subscriptionService.getRemainingLessons(user?.id || '')} remaining today
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {subscription.features.analyticsAccess ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-muted-foreground">Advanced Analytics</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {subscription.features.certificateGeneration ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-muted-foreground">Certificates</div>
                </div>
              </div>
              
              {subscription.plan === 'free' && (
                <div className="mt-4 text-center">
                  <Button onClick={() => router.push('/subscription')} size="sm">
                    Upgrade for Unlimited Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Progress Overview */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{userStats.lessonsCompleted}</div>
                <div className="text-muted-foreground">Lessons Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{userStats.quizzesPassed}</div>
                <div className="text-muted-foreground">Quizzes Passed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{userStats.totalXP}</div>
                <div className="text-muted-foreground">XP Earned</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{userStats.currentStreak}</div>
                <div className="text-muted-foreground">Day Streak</div>
              </div>
            </div>
            
            {userStats.lastLessonDate && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Last activity: {new Date(userStats.lastLessonDate).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}