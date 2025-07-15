interface VoiceSettings {
  rate: number
  pitch: number
  volume: number
  voice: SpeechSynthesisVoice | null
}

interface TextToSpeechOptions {
  text: string
  language?: string
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
}

class VoiceService {
  private synthesis: SpeechSynthesis | null = null
  private voices: SpeechSynthesisVoice[] = []
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private isSupported = false
  private isInitialized = false

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis
      this.isSupported = true
      this.initializeVoices()
    }
  }

  private initializeVoices() {
    if (!this.synthesis) return

    const loadVoices = () => {
      this.voices = this.synthesis!.getVoices()
      this.isInitialized = true
    }

    // Load voices immediately if available
    loadVoices()

    // Some browsers need time to load voices
    if (this.voices.length === 0) {
      this.synthesis.addEventListener('voiceschanged', loadVoices)
    }
  }

  isVoiceSupported(): boolean {
    return this.isSupported && this.isInitialized
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  getBestVoiceForLanguage(language: string = 'en'): SpeechSynthesisVoice | null {
    const voicesForLanguage = this.voices.filter(voice => 
      voice.lang.toLowerCase().startsWith(language.toLowerCase())
    )

    // Prefer local voices
    const localVoice = voicesForLanguage.find(voice => voice.localService)
    if (localVoice) return localVoice

    // Fall back to any voice for the language
    return voicesForLanguage[0] || null
  }

  async speak(options: TextToSpeechOptions): Promise<void> {
    if (!this.synthesis || !this.isSupported) {
      throw new Error('Text-to-speech is not supported in this browser')
    }

    // Stop any current speech
    this.stop()

    const {
      text,
      language = 'en',
      rate = 1,
      pitch = 1,
      volume = 1,
      onStart,
      onEnd,
      onError
    } = options

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Set voice
    const voice = this.getBestVoiceForLanguage(language)
    if (voice) {
      utterance.voice = voice
    }

    // Set speech parameters
    utterance.rate = Math.max(0.1, Math.min(2, rate))
    utterance.pitch = Math.max(0, Math.min(2, pitch))
    utterance.volume = Math.max(0, Math.min(1, volume))
    utterance.lang = language

    // Set event handlers
    utterance.onstart = () => {
      if (onStart) onStart()
    }

    utterance.onend = () => {
      this.currentUtterance = null
      if (onEnd) onEnd()
    }

    utterance.onerror = (event) => {
      this.currentUtterance = null
      if (onError) onError(new Error(event.error))
    }

    this.currentUtterance = utterance
    this.synthesis.speak(utterance)
  }

  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel()
      this.currentUtterance = null
    }
  }

  pause(): void {
    if (this.synthesis) {
      this.synthesis.pause()
    }
  }

  resume(): void {
    if (this.synthesis) {
      this.synthesis.resume()
    }
  }

  isSpeaking(): boolean {
    return this.synthesis?.speaking || false
  }

  isPaused(): boolean {
    return this.synthesis?.paused || false
  }

  // Utility method to speak lesson content in chunks
  async speakLessonContent(content: string, options: Partial<TextToSpeechOptions> = {}): Promise<void> {
    // Split long content into sentences for better speech flow
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        await new Promise<void>((resolve, reject) => {
          this.speak({
            text: sentence.trim(),
            ...options,
            onEnd: resolve,
            onError: reject
          })
        })
      }
    }
  }

  // Get speech settings for different age groups
  getSettingsForAge(ageGroup: 'kindergarten' | 'elementary' | 'middle' | 'high'): Partial<VoiceSettings> {
    switch (ageGroup) {
      case 'kindergarten':
        return { rate: 0.8, pitch: 1.2, volume: 0.9 }
      case 'elementary':
        return { rate: 0.9, pitch: 1.1, volume: 0.9 }
      case 'middle':
        return { rate: 1.0, pitch: 1.0, volume: 0.9 }
      case 'high':
        return { rate: 1.1, pitch: 1.0, volume: 0.9 }
      default:
        return { rate: 1.0, pitch: 1.0, volume: 0.9 }
    }
  }
}

export const voiceService = new VoiceService()
export type { TextToSpeechOptions, VoiceSettings }