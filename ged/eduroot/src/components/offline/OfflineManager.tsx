'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { offlineService } from '@/services/offlineService'
import { 
  Download, 
  Trash2, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Globe, 
  BookOpen,
  Languages,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface OfflineManagerProps {
  onClose: () => void
}

export default function OfflineManager({ onClose }: OfflineManagerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [downloadedLessons, setDownloadedLessons] = useState<any[]>([])
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0, percentage: 0 })
  const [downloading, setDownloading] = useState<string | null>(null)
  const [availableLanguages, setAvailableLanguages] = useState<any[]>([])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    loadOfflineData()
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadOfflineData = () => {
    const lessons = offlineService.getDownloadedLessons()
    const usage = offlineService.getStorageUsage()
    const languages = offlineService.getAvailableLanguages()
    const detectedLang = offlineService.detectLanguage()
    
    setDownloadedLessons(lessons)
    setStorageUsage(usage)
    setAvailableLanguages(languages)
    setSelectedLanguage(detectedLang)
  }

  const handleDownloadPack = async (subject: string, topic: string) => {
    setDownloading(`${subject}_${topic}`)
    
    try {
      await offlineService.downloadLessonPack(subject, topic, selectedLanguage)
      loadOfflineData()
      
      // Show success message
      const message = await offlineService.translateText('Lesson pack downloaded successfully!', selectedLanguage)
      alert(message)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  const handleDeletePack = (lessonId: string) => {
    if (confirm('Are you sure you want to delete this lesson pack?')) {
      offlineService.deleteLessonPack(lessonId)
      loadOfflineData()
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const availablePacks = [
    { subject: 'math', topic: 'algebra', title: 'Algebra Fundamentals' },
    { subject: 'math', topic: 'geometry', title: 'Geometry Basics' },
    { subject: 'math', topic: 'arithmetic', title: 'Arithmetic Skills' },
    { subject: 'english', topic: 'grammar', title: 'Grammar Essentials' },
    { subject: 'english', topic: 'vocabulary', title: 'Vocabulary Building' },
    { subject: 'english', topic: 'reading', title: 'Reading Comprehension' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <HardDrive className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Offline Learning Manager</h2>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>

          {/* Connection Status Alert */}
          {!isOnline && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're currently offline. You can still access downloaded lesson packs and continue learning.
              </AlertDescription>
            </Alert>
          )}

          {/* Storage Usage */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5" />
                <span>Storage Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used: {formatBytes(storageUsage.used)}</span>
                  <span>Total: {formatBytes(storageUsage.total)}</span>
                </div>
                <Progress value={storageUsage.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {storageUsage.percentage.toFixed(1)}% of available storage used
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Language Selection & Available Packs */}
            <div className="space-y-6">
              {/* Language Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Languages className="w-5 h-5" />
                    <span>Language Selection</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {availableLanguages.map((lang) => (
                      <Button
                        key={lang.code}
                        variant={selectedLanguage === lang.code ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedLanguage(lang.code)}
                        className="flex items-center space-x-2"
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Available Lesson Packs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Download className="w-5 h-5" />
                    <span>Available Lesson Packs</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {availablePacks.map((pack) => {
                      const isDownloaded = downloadedLessons.some(
                        lesson => lesson.subject === pack.subject && lesson.topic === pack.topic
                      )
                      const isDownloading = downloading === `${pack.subject}_${pack.topic}`
                      
                      return (
                        <div key={`${pack.subject}_${pack.topic}`} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <div>
                              <h4 className="font-medium">{pack.title}</h4>
                              <p className="text-sm text-muted-foreground capitalize">
                                {pack.subject} • {selectedLanguage}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isDownloaded ? (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Downloaded
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleDownloadPack(pack.subject, pack.topic)}
                                disabled={!isOnline || isDownloading}
                              >
                                {isDownloading ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                {isDownloading ? 'Downloading...' : 'Download'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Downloaded Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Downloaded Lessons</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {downloadedLessons.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No offline content downloaded yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Download lesson packs to access them offline
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {downloadedLessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <div>
                            <h4 className="font-medium">{lesson.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {lesson.subject} • {lesson.topic} • {lesson.language}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Downloaded: {new Date(lesson.downloadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {formatBytes(lesson.size)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePack(lesson.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('This will delete all downloaded content. Are you sure?')) {
                  offlineService.clearAllContent()
                  loadOfflineData()
                }
              }}
              disabled={downloadedLessons.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Content
            </Button>
            
            <div className="text-sm text-muted-foreground">
              {downloadedLessons.length} lesson packs downloaded
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}