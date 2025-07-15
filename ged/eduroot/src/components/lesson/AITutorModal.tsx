'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { aiTutorService } from '@/services/aiTutorService'
import { enhancedVoiceService } from '@/services/enhancedVoiceService'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  MessageCircle, 
  X, 
  Send,
  Brain,
  Sparkles
} from 'lucide-react'

interface AITutorModalProps {
  isOpen: boolean
  onClose: () => void
  lessonTopic: string
  gradeLevel: string
  lessonContent: string
}

interface Message {
  role: 'student' | 'tutor'
  message: string
  timestamp: string
  isPlaying?: boolean
}

export default function AITutorModal({ 
  isOpen, 
  onClose, 
  lessonTopic, 
  gradeLevel, 
  lessonContent 
}: AITutorModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const [recognition, setRecognition] = useState<any>(null)
  const [hasStarted, setHasStarted] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && !hasStarted) {
      initializeTutor()
      setHasStarted(true)
    }

    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = 'en-US'
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInputText(transcript)
        setIsListening(false)
      }
      
      recognitionInstance.onerror = () => {
        setIsListening(false)
      }
      
      recognitionInstance.onend = () => {
        setIsListening(false)
      }
      
      setRecognition(recognitionInstance)
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initializeTutor = () => {
    const session = aiTutorService.startTutorSession(lessonTopic, gradeLevel, lessonContent)
    setMessages(session.conversation.map(msg => ({ ...msg, isPlaying: false })))
    
    // Speak the initial greeting
    if (isVoiceEnabled && session.conversation.length > 0) {
      speakMessage(session.conversation[0].message)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const speakMessage = async (message: string) => {
    if (!isVoiceEnabled) return
    
    try {
      setIsSpeaking(true)
      await enhancedVoiceService.speak({
        text: message,
        provider: 'elevenlabs',
        voice: gradeLevel.includes('kindergarten') || gradeLevel.includes('grade_1') ? 'child' : 'adult'
      })
    } catch (error) {
      console.log('Voice failed, trying web speech:', error)
      try {
        await enhancedVoiceService.speak({
          text: message,
          provider: 'web'
        })
      } catch (webError) {
        console.log('Web speech also failed:', webError)
      }
    } finally {
      setIsSpeaking(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    setIsLoading(true)
    const studentMessage = inputText.trim()
    setInputText('')

    try {
      const tutorResponse = await aiTutorService.askTutor(studentMessage)
      
      // Update messages from the current session
      const session = aiTutorService.getCurrentSession()
      if (session) {
        setMessages(session.conversation.map(msg => ({ ...msg, isPlaying: false })))
        
        // Speak the tutor's response
        if (isVoiceEnabled) {
          setTimeout(() => speakMessage(tutorResponse), 500)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true)
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop()
      setIsListening(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const playMessage = (messageIndex: number) => {
    const message = messages[messageIndex]
    if (message && message.role === 'tutor') {
      speakMessage(message.message)
    }
  }

  const handleClose = () => {
    enhancedVoiceService.stop()
    aiTutorService.endTutorSession()
    setMessages([])
    setHasStarted(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>AI Tutor</span>
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Learning about {lessonTopic} • {gradeLevel}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              >
                {isVoiceEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'student'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm">{message.message}</p>
                    {message.role === 'tutor' && isVoiceEnabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 p-1 h-6 w-6"
                        onClick={() => playMessage(index)}
                      >
                        <Volume2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-muted-foreground">Tutor is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            {isSpeaking && (
              <div className="flex justify-center">
                <Badge variant="secondary" className="animate-pulse">
                  🔊 Tutor is speaking...
                </Badge>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask your tutor anything about this lesson..."
                  className="w-full px-3 py-2 border border-input bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex flex-col space-y-1">
                {recognition && (
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    size="sm"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                )}
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {isListening && (
              <div className="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Listening... speak your question</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}