'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { curriculumService } from '@/services/curriculumService'
import { progressService } from '@/services/progressService'

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
  const { user, loading } = useAuth()
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
      
      // Load user stats and last lesson
      loadUserProgress()
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">EduRoot Dashboard</h1>
              <p className="text-gray-600">
                Welcome back, {user.email}! 
                {userPlacement && <span className="ml-2 text-blue-600">• Placed at {userPlacement}</span>}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 px-3 py-1 rounded-full">
                <span className="text-blue-800 text-sm font-medium">Level: {currentGrade.replace('_', ' ')}</span>
              </div>
              <button 
                onClick={() => {
                  // Clear all demo data for testing
                  if (user) {
                    localStorage.removeItem(`onboarding_${user.id}`)
                    localStorage.removeItem(`placement_${user.id}`)
                    progressService.clearProgress(user.id)
                  }
                  router.push('/')
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subject Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Subject</h2>
          <div className="flex space-x-4">
            {subjects.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  selectedSubject === subject
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {subject === 'math' ? 'Mathematics' : 'English Language Arts'}
              </button>
            ))}
          </div>
        </div>

        {/* Grade Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Grade Level</h2>
          <select
            value={currentGrade}
            onChange={(e) => setCurrentGrade(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="kindergarten">Kindergarten</option>
            <option value="grade_1">1st Grade</option>
            <option value="grade_2">2nd Grade</option>
            <option value="grade_3">3rd Grade</option>
          </select>
        </div>

        {/* Continue Learning Section */}
        {lastLesson && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white mb-8">
            <h2 className="text-xl font-bold mb-2">Continue Learning</h2>
            <p className="mb-4">
              Resume your lesson: <span className="font-semibold">{lastLesson.subtopic.replace(/_/g, ' ')}</span>
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => startLesson(lastLesson.topic, lastLesson.subtopic)}
                className="bg-white text-blue-600 px-6 py-2 rounded-md font-medium hover:bg-gray-100"
              >
                {lastLesson.completed ? 'Review Lesson' : 'Continue Lesson'}
              </button>
              {lastLesson.completed && (
                <div className="bg-green-500 text-white px-3 py-2 rounded-md text-sm">
                  ✅ Completed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Learning Path */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Your Learning Path</h2>
          
          {topics.map((topic) => (
            <div key={topic.id} className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{topic.name}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topic.subtopics.map((subtopic) => (
                  <div
                    key={subtopic.id}
                    className={`border rounded-lg p-4 transition-colors relative ${
                      subtopic.completed
                        ? 'border-green-300 bg-green-50'
                        : subtopic.unlocked
                        ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{subtopic.name}</h4>
                      {subtopic.completed && (
                        <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                          ✅ Complete
                        </div>
                      )}
                    </div>
                    
                    {subtopic.unlocked ? (
                      <button
                        onClick={() => startLesson(topic.id, subtopic.id)}
                        className={`w-full py-2 px-4 rounded-md transition-colors ${
                          subtopic.completed
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {subtopic.completed ? 'Review Lesson' : 'Start Lesson'}
                      </button>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        🔒 Complete previous lessons to unlock
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Overview */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{userStats.lessonsCompleted}</div>
              <div className="text-gray-600">Lessons Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{userStats.quizzesPassed}</div>
              <div className="text-gray-600">Quizzes Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{userStats.totalXP}</div>
              <div className="text-gray-600">XP Earned</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{userStats.currentStreak}</div>
              <div className="text-gray-600">Day Streak</div>
            </div>
          </div>
          
          {userStats.lastLessonDate && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Last activity: {new Date(userStats.lastLessonDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}