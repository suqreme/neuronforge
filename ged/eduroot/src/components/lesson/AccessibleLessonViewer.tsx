'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { enhancedVoiceService } from '@/services/enhancedVoiceService'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipForward, 
  SkipBack,
  Settings,
  BookOpen,
  Mic,
  Eye,
  Hand,
  Users,
  Headphones,
  Zap,
  RotateCcw
} from 'lucide-react'

interface AccessibleLessonProps {
  lesson: {
    subject: string
    topic: string
    subtopic: string
    content: string
    gradeLevel: string
  }
  onComplete: () => void
  onExit: () => void
}

export default function AccessibleLessonViewer({ lesson, onComplete, onExit }: AccessibleLessonProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentSentence, setCurrentSentence] = useState(0)
  const [sentences, setSentences] = useState<string[]>([])
  const [readingProgress, setReadingProgress] = useState(0)
  const [voiceProvider, setVoiceProvider] = useState<'web' | 'elevenlabs' | 'google'>('web')
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9,
    ageGroup: 'child' as 'child' | 'adult' | 'auto'
  })
  const [learningMode, setLearningMode] = useState<'visual' | 'audio' | 'interactive'>('interactive')
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<any[]>([])
  const [autoPlay, setAutoPlay] = useState(false)
  const [highlightSentences, setHighlightSentences] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check voice support and get available providers
    setIsVoiceSupported(enhancedVoiceService.isSupported())
    setAvailableProviders(enhancedVoiceService.getAvailableProviders())
    
    // Set age group based on grade level
    const gradeLevel = lesson.gradeLevel.toLowerCase()
    if (gradeLevel.includes('kindergarten') || gradeLevel.includes('grade_1') || gradeLevel.includes('grade_2')) {
      enhancedVoiceService.setAgeGroup('child')
      setVoiceSettings(prev => ({ ...prev, ageGroup: 'child' }))
    } else {
      enhancedVoiceService.setAgeGroup('adult')
      setVoiceSettings(prev => ({ ...prev, ageGroup: 'adult' }))
    }
  }, [lesson.gradeLevel])

  useEffect(() => {
    // Split content into sentences for progressive reading
    const sentenceList = lesson.content
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim())
    
    setSentences(sentenceList)
    setCurrentSentence(0)
  }, [lesson.content])

  useEffect(() => {
    // Auto-play lesson if enabled
    if (autoPlay && sentences.length > 0) {
      handlePlayPause()
    }
  }, [autoPlay, sentences])

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
      // Start reading from current sentence
      await startReading()
    }
  }

  const startReading = async () => {
    if (sentences.length === 0) return
    
    setIsPlaying(true)
    setIsPaused(false)

    try {
      for (let i = currentSentence; i < sentences.length; i++) {
        setCurrentSentence(i)
        setReadingProgress((i / sentences.length) * 100)
        
        // Highlight current sentence
        if (highlightSentences) {
          highlightSentence(i)
        }

        await enhancedVoiceService.speak({
          text: sentences[i],
          provider: voiceProvider,
          rate: voiceSettings.rate,
          pitch: voiceSettings.pitch,
          volume: voiceSettings.volume,
          onStart: () => {
            setIsPlaying(true)
          },
          onEnd: () => {
            // Small pause between sentences
            return new Promise(resolve => setTimeout(resolve, 800))
          }
        })

        // Check if we should stop (user paused or stopped)
        if (!isPlaying) break
      }
      
      // Reading complete
      setIsPlaying(false)
      setReadingProgress(100)
      setCurrentSentence(0)
      
    } catch (error) {
      console.error('Reading error:', error)
      setIsPlaying(false)
      setIsPaused(false)
    }
  }

  const highlightSentence = (index: number) => {
    if (!contentRef.current) return
    
    const spans = contentRef.current.querySelectorAll('.sentence')
    spans.forEach((span, i) => {
      if (i === index) {
        span.classList.add('bg-primary/20', 'border-l-4', 'border-primary', 'pl-2')
      } else {
        span.classList.remove('bg-primary/20', 'border-l-4', 'border-primary', 'pl-2')
      }
    })
  }

  const handleStop = () => {
    enhancedVoiceService.stop()
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentSentence(0)
    setReadingProgress(0)
    
    // Clear highlights
    if (contentRef.current) {
      const spans = contentRef.current.querySelectorAll('.sentence')
      spans.forEach(span => {
        span.classList.remove('bg-primary/20', 'border-l-4', 'border-primary', 'pl-2')
      })
    }
  }

  const skipToSentence = (index: number) => {
    handleStop()
    setCurrentSentence(index)
    setReadingProgress((index / sentences.length) * 100)
  }

  const handleSkipBack = () => {
    const newIndex = Math.max(0, currentSentence - 1)
    skipToSentence(newIndex)
  }

  const handleSkipForward = () => {
    const newIndex = Math.min(sentences.length - 1, currentSentence + 1)
    skipToSentence(newIndex)
  }

  const renderContent = () => {
    if (learningMode === 'visual') {
      return (
        <div className="prose prose-lg max-w-none">
          <div ref={contentRef} className="text-lg leading-relaxed space-y-4">
            {sentences.map((sentence, index) => (
              <span
                key={index}
                className={`sentence cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors ${
                  index === currentSentence ? 'bg-primary/10' : ''
                }`}
                onClick={() => skipToSentence(index)}
              >
                {sentence}
                {index < sentences.length - 1 && '. '}
              </span>
            ))}
          </div>
        </div>
      )
    }

    if (learningMode === 'audio') {
      return (
        <div className="text-center space-y-6">
          <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto">
            <Headphones className="w-16 h-16 text-primary" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">Audio Learning Mode</h3>
            <p className="text-lg text-muted-foreground">
              Listen to the lesson content. Follow along with the progress bar below.
            </p>
            <div className="text-sm text-muted-foreground">
              Sentence {currentSentence + 1} of {sentences.length}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Read Along</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={contentRef} className="text-base leading-relaxed">
                {sentences.map((sentence, index) => (
                  <span
                    key={index}
                    className={`sentence cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors ${
                      index === currentSentence ? 'bg-primary/10 border-l-4 border-primary pl-2' : ''
                    }`}
                    onClick={() => skipToSentence(index)}
                  >
                    {sentence}
                    {index < sentences.length - 1 && '. '}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Hand className="w-5 h-5" />
                <span>Interactive Controls</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant={autoPlay ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoPlay(!autoPlay)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Auto-Play
                </Button>
                <Button
                  variant={highlightSentences ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHighlightSentences(!highlightSentences)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Highlight
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Reading Speed</label>
                <Slider
                  value={[voiceSettings.rate]}
                  onValueChange={(value) => setVoiceSettings(prev => ({ ...prev, rate: value[0] }))}
                  max={2}
                  min={0.5}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slow</span>
                  <span>Normal</span>
                  <span>Fast</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Voice Type</label>
                <Select value={voiceProvider} onValueChange={(value: any) => setVoiceProvider(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map(provider => (
                      <SelectItem key={provider.name} value={provider.name}>
                        {provider.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
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
                onClick={onExit}
                className="mb-2"
              >
                ← Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-foreground">{lesson.subtopic}</h1>
              <p className="text-muted-foreground">{lesson.subject} • {lesson.topic}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{lesson.gradeLevel}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Learning Mode Selector */}
        <div className="mb-8">
          <div className="flex space-x-4">
            <Button
              variant={learningMode === 'visual' ? 'default' : 'outline'}
              onClick={() => setLearningMode('visual')}
              className="flex items-center space-x-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Visual</span>
            </Button>
            <Button
              variant={learningMode === 'audio' ? 'default' : 'outline'}
              onClick={() => setLearningMode('audio')}
              className="flex items-center space-x-2"
            >
              <Headphones className="w-4 h-4" />
              <span>Audio</span>
            </Button>
            <Button
              variant={learningMode === 'interactive' ? 'default' : 'outline'}
              onClick={() => setLearningMode('interactive')}
              className="flex items-center space-x-2"
            >
              <Hand className="w-4 h-4" />
              <span>Interactive</span>
            </Button>
          </div>
        </div>

        {/* Voice Controls */}
        {isVoiceSupported && (
          <Card className="mb-8">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={handlePlayPause}
                    disabled={sentences.length === 0}
                    className="flex items-center space-x-2"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleStop}
                    disabled={!isPlaying && !isPaused}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleSkipBack}
                    disabled={currentSentence === 0}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleSkipForward}
                    disabled={currentSentence >= sentences.length - 1}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground">
                    {currentSentence + 1} / {sentences.length}
                  </div>
                  <div className="w-32">
                    <Progress value={readingProgress} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lesson Content */}
        <Card>
          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>

        {/* Complete Button */}
        <div className="mt-8 text-center">
          <Button onClick={onComplete} size="lg">
            Complete Lesson
          </Button>
        </div>
      </main>
    </div>
  )
}