'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { voiceService } from '@/services/voiceService'
import { enhancedVoiceService } from '@/services/enhancedVoiceService'
import AITutorModal from './AITutorModal'
import { Play, Pause, Volume2, VolumeX, RotateCcw, Settings, Zap, Crown, MessageCircle, Brain } from 'lucide-react'

interface LessonData {
  lesson: string
  metadata: {
    topic: string
    subtopic: string
    grade_level: string
    subject: string
  }
}

interface LessonContentProps {
  lessonData: LessonData
  onComplete: () => void
}

export default function LessonContent({ lessonData, onComplete }: LessonContentProps) {
  const [currentSection, setCurrentSection] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [currentSentence, setCurrentSentence] = useState(0)
  const [sentences, setSentences] = useState<string[]>([])
  const [voiceProvider, setVoiceProvider] = useState<'web' | 'elevenlabs'>('web')
  const [availableProviders, setAvailableProviders] = useState<any[]>([])
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [isElevenLabsAvailable, setIsElevenLabsAvailable] = useState(false)
  const [showTutorModal, setShowTutorModal] = useState(false)

  // Split lesson content into sections for better pacing - memoized to prevent infinite loops
  const sections = useMemo(() => 
    lessonData.lesson.split('\n\n').filter(section => section.trim().length > 0),
    [lessonData.lesson]
  )

  // Initialize voice service once
  useEffect(() => {
    // Check if voice is supported
    setIsVoiceSupported(enhancedVoiceService.isSupported())
    
    // Get available voice providers
    const providers = enhancedVoiceService.getAvailableProviders()
    setAvailableProviders(providers)
    
    // Check if ElevenLabs is available
    const elevenLabsProvider = providers.find(p => p.name === 'elevenlabs')
    setIsElevenLabsAvailable(elevenLabsProvider?.isAvailable || false)
    
    // Set age-appropriate voice based on grade level
    const gradeLevel = lessonData.metadata.grade_level.toLowerCase()
    if (gradeLevel.includes('kindergarten') || gradeLevel.includes('grade_1') || gradeLevel.includes('grade_2')) {
      enhancedVoiceService.setAgeGroup('child')
    } else {
      enhancedVoiceService.setAgeGroup('adult')
    }
  }, [lessonData.metadata.grade_level])

  // Split current section into sentences when section changes
  useEffect(() => {
    const currentText = sections[currentSection] || ''
    const sentenceList = currentText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    setSentences(sentenceList)
    setCurrentSentence(0)
  }, [currentSection, sections])

  const handlePlayPause = async () => {
    if (isPlaying) {
      enhancedVoiceService.pause()
      setIsPlaying(false)
      setIsPaused(true)
    } else if (isPaused) {
      enhancedVoiceService.resume()
      setIsPlaying(true)
      setIsPaused(false)
    } else {
      // Start reading current section
      const textToRead = sections[currentSection] || ''
      if (textToRead.trim()) {
        setIsPlaying(true)
        setIsPaused(false)
        
        try {
          await enhancedVoiceService.speak({
            text: textToRead,
            provider: voiceProvider,
            rate: 0.9, // Slightly slower for learning
            onStart: () => setIsPlaying(true),
            onEnd: () => {
              setIsPlaying(false)
              setIsPaused(false)
            },
            onError: (error) => {
              console.error('Speech error:', error)
              setIsPlaying(false)
              setIsPaused(false)
            }
          })
        } catch (error) {
          console.error('Speech error:', error)
          setIsPlaying(false)
          setIsPaused(false)
        }
      }
    }
  }

  const handleStop = () => {
    enhancedVoiceService.stop()
    setIsPlaying(false)
    setIsPaused(false)
  }

  const goToNext = () => {
    handleStop() // Stop reading when navigating
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1)
    } else {
      setIsComplete(true)
    }
  }

  const goToPrevious = () => {
    handleStop() // Stop reading when navigating
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  return (
    <Card>
      {/* Progress Bar */}
      <CardHeader>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">Lesson Progress</span>
          <span className="text-sm text-muted-foreground">
            {isComplete ? 'Complete!' : `${currentSection + 1} of ${sections.length}`}
          </span>
        </div>
        <Progress 
          value={isComplete ? 100 : ((currentSection + 1) / sections.length) * 100}
          className="h-2"
        />
      </CardHeader>

      {/* Voice Controls */}
      {isVoiceSupported && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Audio Assistant</span>
                <Badge variant="secondary" className="text-xs">
                  For Non-Readers
                </Badge>
                {voiceProvider === 'elevenlabs' && (
                  <Badge variant="default" className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handlePlayPause}
                  disabled={!sections[currentSection]?.trim()}
                  variant={isPlaying ? "default" : "outline"}
                  size="sm"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {isPaused ? 'Resume' : 'Read Aloud'}
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleStop}
                  disabled={!isPlaying && !isPaused}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>

                <Button
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Voice
                </Button>

                <Button
                  onClick={() => setShowTutorModal(true)}
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Ask Tutor
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              {isPlaying ? '🔊 Reading aloud...' : isPaused ? '⏸️ Paused' : '👂 Click "Read Aloud" to listen'}
            </div>
          </div>

          {/* Voice Settings Panel */}
          {showVoiceSettings && (
            <div className="mt-4 p-4 bg-card rounded-lg border">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Voice Provider</label>
                  <Select value={voiceProvider} onValueChange={(value: 'web' | 'elevenlabs') => setVoiceProvider(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">
                        <div className="flex items-center space-x-2">
                          <Volume2 className="w-4 h-4" />
                          <span>Browser Voice (Free)</span>
                        </div>
                      </SelectItem>
                      {isElevenLabsAvailable && (
                        <SelectItem value="elevenlabs">
                          <div className="flex items-center space-x-2">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            <span>ElevenLabs (Premium)</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {!isElevenLabsAvailable && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Premium voices require ElevenLabs API key
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Quality</label>
                    <p className="text-xs text-muted-foreground">
                      {voiceProvider === 'elevenlabs' ? 'High-quality AI voices' : 'Standard browser voices'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Age-Appropriate</label>
                    <p className="text-xs text-muted-foreground">
                      {lessonData.metadata.grade_level.includes('kindergarten') || lessonData.metadata.grade_level.includes('grade_1') ? 'Child-friendly voice' : 'Adult voice'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Not Supported Message */}
      {!isVoiceSupported && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <div className="flex items-center space-x-2 text-destructive">
            <VolumeX className="w-4 h-4" />
            <span className="text-sm">
              Voice reading is not supported in this browser. For audio support, try using Chrome, Firefox, or Safari.
            </span>
          </div>
        </div>
      )}

      {/* Lesson Content */}
      <CardContent>
        {!isComplete ? (
          <div className="space-y-6">
            {/* Current Section */}
            <div className="prose max-w-none">
              <div className="text-lg leading-relaxed whitespace-pre-line text-foreground">
                {sections[currentSection]}
              </div>
            </div>

            {/* Tutor Help Section */}
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Need Help Understanding?</h4>
                    <p className="text-sm text-muted-foreground">Chat with your AI tutor - ask questions, get explanations!</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowTutorModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Talk to Tutor
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 border-t border-border">
              <Button
                onClick={goToPrevious}
                disabled={currentSection === 0}
                variant="ghost"
              >
                ← Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                Section {currentSection + 1} of {sections.length}
              </div>

              <Button
                onClick={goToNext}
              >
                {currentSection === sections.length - 1 ? 'Finish Lesson' : 'Next →'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-green-500 text-4xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-foreground mb-4">Lesson Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Great job! You&apos;ve finished learning about {lessonData.metadata.subtopic}. 
              Now let&apos;s test your understanding with a quiz.
            </p>
            <Button
              onClick={handleComplete}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Take the Quiz
            </Button>
          </div>
        )}
      </CardContent>

      {/* Learning Objective Reminder */}
      <div className="bg-accent/20 p-4 border-t border-border">
        <h4 className="font-medium text-foreground mb-2">Learning Objective</h4>
        <p className="text-muted-foreground text-sm">
          By the end of this lesson, you should be able to understand and apply concepts related to {lessonData.metadata.subtopic}.
        </p>
      </div>

      {/* AI Tutor Modal */}
      <AITutorModal
        isOpen={showTutorModal}
        onClose={() => setShowTutorModal(false)}
        lessonTopic={lessonData.metadata.subtopic}
        gradeLevel={lessonData.metadata.grade_level}
        lessonContent={lessonData.lesson}
      />
    </Card>
  )
}