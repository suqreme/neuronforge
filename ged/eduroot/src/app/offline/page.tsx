'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/ui/user-menu'
import OfflineManager from '@/components/offline/OfflineManager'
import OfflineLessonViewer from '@/components/offline/OfflineLessonViewer'
import { offlineService } from '@/services/offlineService'
import { 
  Download, 
  BookOpen, 
  WifiOff, 
  Languages,
  HardDrive,
  Play,
  Settings,
  Globe
} from 'lucide-react'

export default function OfflinePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [showManager, setShowManager] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [downloadedLessons, setDownloadedLessons] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [currentLanguage, setCurrentLanguage] = useState('en')
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0, percentage: 0 })

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    // Check if we're in the browser
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      loadOfflineData()
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [user, router])

  const loadOfflineData = () => {
    const lessons = offlineService.getDownloadedLessons()
    const usage = offlineService.getStorageUsage()
    const detectedLang = offlineService.detectLanguage()
    
    setDownloadedLessons(lessons)
    setStorageUsage(usage)
    setCurrentLanguage(detectedLang)
  }

  const handleLessonComplete = (score: number) => {
    // Award points for offline completion
    console.log('Offline lesson completed with score:', score)
    setSelectedLesson(null)
    loadOfflineData()
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const groupedLessons = downloadedLessons.reduce((groups: any, lesson: any) => {
    const key = lesson.subject
    if (!groups[key]) groups[key] = []
    groups[key].push(lesson)
    return groups
  }, {})

  if (!user) return null

  // Show lesson viewer if a lesson is selected
  if (selectedLesson) {
    return (
      <OfflineLessonViewer
        lessonId={selectedLesson}
        onComplete={handleLessonComplete}
        onExit={() => setSelectedLesson(null)}
      />
    )
  }

  // Show offline manager modal
  if (showManager) {
    return (
      <OfflineManager
        onClose={() => {
          setShowManager(false)
          loadOfflineData()
        }}
      />
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
              <h1 className="text-2xl font-bold text-foreground">Offline Learning</h1>
              <p className="text-muted-foreground">Access your downloaded lessons anytime, anywhere</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Globe className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <BookOpen className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{downloadedLessons.length}</p>
                  <p className="text-sm text-muted-foreground">Downloaded Lessons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{formatBytes(storageUsage.used)}</p>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Languages className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{new Set(downloadedLessons.map(l => l.language)).size}</p>
                  <p className="text-sm text-muted-foreground">Languages Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Actions */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Offline Content</h2>
            <Button onClick={() => setShowManager(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Downloads
            </Button>
          </div>
        </div>

        {/* Downloaded Lessons */}
        {downloadedLessons.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Download className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Offline Content</h3>
              <p className="text-muted-foreground mb-6">
                Download lesson packs to access them offline and continue learning anywhere
              </p>
              <Button onClick={() => setShowManager(true)}>
                <Download className="w-4 h-4 mr-2" />
                Download Lessons
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedLessons).map(([subject, lessons]: [string, any[]]) => (
              <Card key={subject}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 capitalize">
                    <BookOpen className="w-5 h-5" />
                    <span>{subject}</span>
                    <Badge variant="outline" className="ml-auto">
                      {lessons.length} lessons
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lessons.map((lesson) => (
                      <Card key={lesson.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-sm">{lesson.title}</h4>
                              <p className="text-xs text-muted-foreground capitalize">
                                {lesson.topic} • {lesson.subtopic}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {lesson.language}
                                </Badge>
                                <span className="text-muted-foreground">{lesson.estimatedTime}</span>
                              </div>
                              <span className="text-muted-foreground">{formatBytes(lesson.size)}</span>
                            </div>
                            
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => setSelectedLesson(lesson.id)}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Lesson
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Offline Benefits */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <WifiOff className="w-5 h-5" />
              <span>Offline Learning Benefits</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <WifiOff className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">No Internet Required</h4>
                <p className="text-sm text-muted-foreground">
                  Access downloaded lessons even without internet connection
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Languages className="w-6 h-6 text-green-500" />
                </div>
                <h4 className="font-semibold mb-2">Multilingual Support</h4>
                <p className="text-sm text-muted-foreground">
                  Download lessons in your preferred language
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="font-semibold mb-2">Full Content</h4>
                <p className="text-sm text-muted-foreground">
                  Complete lessons with quizzes and explanations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}