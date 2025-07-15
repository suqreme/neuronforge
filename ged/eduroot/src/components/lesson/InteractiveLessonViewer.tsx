'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { voiceService } from '@/services/voiceService'
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
  Hand
} from 'lucide-react'

interface InteractiveLessonProps {
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

export default function InteractiveLessonViewer({ lesson, onComplete, onExit }: InteractiveLessonProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSentence, setCurrentSentence] = useState(0)
  const [sentences, setSentences] = useState<string[]>([])
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9
  })
  const [learningMode, setLearningMode] = useState<'visual' | 'audio' | 'interactive'>('visual')
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check voice support
    setIsVoiceSupported(voiceService.isVoiceSupported())

    // Split content into sentences
    const splitSentences = lesson.content
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim())
    
    setSentences(splitSentences)

    // Set age-appropriate voice settings
    const ageSettings = voiceService.getSettingsForAge(
      lesson.gradeLevel === 'kindergarten' ? 'kindergarten' : 'elementary'
    )
    setVoiceSettings(prev => ({ ...prev, ...ageSettings }))
  }, [lesson])

  const handlePlayPause = async () => {
    if (isPlaying) {
      voiceService.pause()
      setIsPlaying(false)
    } else {
      if (voiceService.isPaused()) {
        voiceService.resume()
        setIsPlaying(true)
      } else {
        await playFromSentence(currentSentence)
      }
    }
  }

  const playFromSentence = async (startIndex: number) => {
    if (!isVoiceSupported || startIndex >= sentences.length) return

    setIsPlaying(true)
    setCurrentSentence(startIndex)

    try {
      for (let i = startIndex; i < sentences.length; i++) {
        setCurrentSentence(i)
        
        // Highlight current sentence
        highlightSentence(i)

        await voiceService.speak({
          text: sentences[i],
          language: 'en',
          rate: voiceSettings.rate,
          pitch: voiceSettings.pitch,
          volume: voiceSettings.volume,
          onEnd: () => {
            if (i === sentences.length - 1) {
              setIsPlaying(false)
              setCurrentSentence(0)
            }
          }
        })

        // Small pause between sentences
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error('Speech error:', error)
      setIsPlaying(false)
    }
  }

  const highlightSentence = (index: number) => {
    if (contentRef.current) {
      const sentenceElements = contentRef.current.querySelectorAll('.sentence')
      sentenceElements.forEach((el, i) => {
        if (i === index) {
          el.classList.add('bg-primary/20', 'rounded', 'px-1')
        } else {
          el.classList.remove('bg-primary/20', 'rounded', 'px-1')
        }
      })
    }
  }

  const handleStop = () => {
    voiceService.stop()
    setIsPlaying(false)
    setCurrentSentence(0)
    // Remove highlights
    if (contentRef.current) {
      const sentenceElements = contentRef.current.querySelectorAll('.sentence')
      sentenceElements.forEach(el => {
        el.classList.remove('bg-primary/20', 'rounded', 'px-1')
      })
    }
  }

  const handlePrevious = () => {
    if (currentSentence > 0) {
      handleStop()
      playFromSentence(currentSentence - 1)
    }
  }

  const handleNext = () => {
    if (currentSentence < sentences.length - 1) {
      handleStop()
      playFromSentence(currentSentence + 1)
    }
  }

  const renderContent = () => {
    if (learningMode === 'visual') {
      return (
        <div ref={contentRef} className="prose max-w-none">
          {sentences.map((sentence, index) => (
            <span
              key={index}
              className={`sentence cursor-pointer hover:bg-muted/50 transition-colors ${
                index === currentSentence ? 'bg-primary/20 rounded px-1' : ''
              }`}
              onClick={() => playFromSentence(index)}
            >
              {sentence}
              {index < sentences.length - 1 && '. '}
            </span>
          ))}
        </div>
      )
    } else if (learningMode === 'audio') {
      return (
        <div className="text-center space-y-6">
          <div className="w-32 h-32 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Volume2 className="w-16 h-16 text-primary" />
          </div>
          <div className="text-lg font-medium">
            {sentences[currentSentence] || 'Click play to start audio lesson'}
          </div>
          <Progress value={(currentSentence / sentences.length) * 100} className="mx-auto max-w-md" />
        </div>
      )
    } else {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Visual Learning</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  {sentences.slice(0, 3).map((sentence, index) => (
                    <p key={index} className="cursor-pointer hover:bg-muted/50 p-2 rounded">
                      {sentence}.
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Hand className="w-5 h-5" />
                  <span>Interactive Elements</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => playFromSentence(0)}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Read Aloud
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setLearningMode('visual')}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Text Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <Button variant="ghost" size="sm" onClick={onExit}>
                ← Back
              </Button>
              <h1 className="text-xl font-bold mt-2">{lesson.topic}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {lesson.subject} • {lesson.subtopic}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{lesson.gradeLevel.replace('_', ' ')}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Learning Mode Selector */}
      <div className="bg-muted/30 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex space-x-2">
            <Button
              variant={learningMode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLearningMode('visual')}
            >
              <Eye className="w-4 h-4 mr-2" />
              Visual
            </Button>
            <Button
              variant={learningMode === 'audio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLearningMode('audio')}
              disabled={!isVoiceSupported}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Audio
            </Button>
            <Button
              variant={learningMode === 'interactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLearningMode('interactive')}
            >
              <Hand className="w-4 h-4 mr-2" />
              Interactive
            </Button>
          </div>
        </div>
      </div>

      {/* Audio Controls */}
      {isVoiceSupported && (
        <div className="bg-card border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={currentSentence === 0}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStop}
              >
                <VolumeX className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                disabled={currentSentence >= sentences.length - 1}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>Lesson Content</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="mt-8 text-center">
          <Button onClick={onComplete} size="lg">
            Continue to Quiz
          </Button>
        </div>
      </main>

      {/* Voice Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Speed</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">{voiceSettings.rate}x</div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Pitch</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">{voiceSettings.pitch}x</div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Volume</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={voiceSettings.volume}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">{Math.round(voiceSettings.volume * 100)}%</div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  voiceService.speak({
                    text: "This is a test of the voice settings.",
                    rate: voiceSettings.rate,
                    pitch: voiceSettings.pitch,
                    volume: voiceSettings.volume
                  })
                }}>
                  Test Voice
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}