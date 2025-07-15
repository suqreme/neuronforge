interface VoiceProvider {
  name: string
  displayName: string
  isAvailable: boolean
  isOnline: boolean
  supportedLanguages: string[]
}

interface EnhancedVoiceSettings {
  provider: 'web' | 'elevenlabs' | 'google'
  voice: string
  rate: number
  pitch: number
  volume: number
  language: string
  ageGroup: 'child' | 'adult' | 'auto'
}

interface TextToSpeechOptions {
  text: string
  provider?: 'web' | 'elevenlabs' | 'google'
  voice?: string
  language?: string
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
  onProgress?: (progress: number) => void
}

class EnhancedVoiceService {
  private webSynthesis: SpeechSynthesis | null = null
  private webVoices: SpeechSynthesisVoice[] = []
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private isWebSupported = false
  private audioContext: AudioContext | null = null
  private currentAudio: HTMLAudioElement | null = null
  
  private settings: EnhancedVoiceSettings = {
    provider: 'web',
    voice: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9,
    language: 'en-US',
    ageGroup: 'auto'
  }

  constructor() {
    this.initializeWebSpeech()
  }

  private initializeWebSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.webSynthesis = window.speechSynthesis
      this.isWebSupported = true
      this.loadWebVoices()
    }
  }

  private loadWebVoices() {
    if (!this.webSynthesis) return

    const loadVoices = () => {
      this.webVoices = this.webSynthesis!.getVoices()
    }

    loadVoices()
    if (this.webVoices.length === 0) {
      this.webSynthesis.addEventListener('voiceschanged', loadVoices)
    }
  }

  public getAvailableProviders(): VoiceProvider[] {
    const providers: VoiceProvider[] = []

    // Web Speech API (always available in browsers)
    providers.push({
      name: 'web',
      displayName: 'Browser Voice (Free)',
      isAvailable: this.isWebSupported,
      isOnline: true,
      supportedLanguages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE']
    })

    // ElevenLabs (premium, requires API key)
    providers.push({
      name: 'elevenlabs',
      displayName: 'ElevenLabs (Premium)',
      isAvailable: !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      isOnline: true,
      supportedLanguages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pl-PL', 'pt-BR']
    })

    // Google Cloud TTS (good quality, pay-per-use)
    providers.push({
      name: 'google',
      displayName: 'Google Cloud TTS',
      isAvailable: !!process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY,
      isOnline: true,
      supportedLanguages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'ko-KR', 'zh-CN']
    })

    return providers
  }

  public async speak(options: TextToSpeechOptions): Promise<void> {
    const provider = options.provider || this.settings.provider
    
    try {
      switch (provider) {
        case 'web':
          return this.speakWithWebAPI(options)
        case 'elevenlabs':
          return this.speakWithElevenLabs(options)
        case 'google':
          return this.speakWithGoogleTTS(options)
        default:
          return this.speakWithWebAPI(options)
      }
    } catch (error) {
      console.error(`Voice synthesis error with ${provider}:`, error)
      // Fallback to web speech if premium provider fails
      if (provider !== 'web') {
        return this.speakWithWebAPI(options)
      }
      throw error
    }
  }

  private async speakWithWebAPI(options: TextToSpeechOptions): Promise<void> {
    if (!this.webSynthesis) {
      throw new Error('Web Speech API not supported')
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text)
      
      // Configure voice settings
      utterance.rate = Math.max(0.1, Math.min(2, options.rate || this.settings.rate))
      utterance.pitch = Math.max(0, Math.min(2, options.pitch || this.settings.pitch))
      utterance.volume = Math.max(0, Math.min(1, options.volume || this.settings.volume))
      utterance.lang = options.language || this.settings.language

      // Select appropriate voice
      const voice = this.selectBestVoice(options.language || this.settings.language)
      if (voice) {
        utterance.voice = voice
      }

      // Event handlers
      utterance.onstart = () => {
        options.onStart?.()
      }

      utterance.onend = () => {
        options.onEnd?.()
        resolve()
      }

      utterance.onerror = (event) => {
        const error = new Error(`Speech synthesis error: ${event.error}`)
        options.onError?.(error)
        reject(error)
      }

      // Stop any current speech
      this.stop()
      
      // Start speaking
      this.currentUtterance = utterance
      this.webSynthesis.speak(utterance)
    })
  }

  private async speakWithElevenLabs(options: TextToSpeechOptions): Promise<void> {
    try {
      const response = await fetch('/api/voice/elevenlabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: options.text,
          ageGroup: this.settings.ageGroup,
          voice: options.voice || 'default'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `ElevenLabs API error: ${response.status}`)
      }

      const audioBuffer = await response.arrayBuffer()
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)

      return this.playAudio(audioUrl, options)
    } catch (error) {
      console.error('ElevenLabs error:', error)
      throw error
    }
  }

  private async speakWithGoogleTTS(options: TextToSpeechOptions): Promise<void> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY
    if (!apiKey) {
      throw new Error('Google TTS API key not configured')
    }

    // Select voice based on age group
    const voiceName = this.settings.ageGroup === 'child' 
      ? 'en-US-Standard-I' // Child-like voice
      : 'en-US-Standard-C' // Adult voice

    try {
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: options.text },
          voice: {
            languageCode: options.language || 'en-US',
            name: voiceName
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: options.rate || 1.0,
            pitch: (options.pitch || 1.0) * 2 - 2, // Convert to Google's range
            volumeGainDb: ((options.volume || 0.9) - 0.5) * 20
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Google TTS API error: ${response.status}`)
      }

      const data = await response.json()
      const audioBuffer = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)

      return this.playAudio(audioUrl, options)
    } catch (error) {
      console.error('Google TTS error:', error)
      throw error
    }
  }

  private async playAudio(audioUrl: string, options: TextToSpeechOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl)
      
      audio.onloadstart = () => {
        options.onStart?.()
      }

      audio.onended = () => {
        options.onEnd?.()
        URL.revokeObjectURL(audioUrl)
        resolve()
      }

      audio.onerror = () => {
        const error = new Error('Audio playback failed')
        options.onError?.(error)
        reject(error)
      }

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          const progress = (audio.currentTime / audio.duration) * 100
          options.onProgress?.(progress)
        }
      }

      this.currentAudio = audio
      audio.play()
    })
  }

  private selectBestVoice(language: string): SpeechSynthesisVoice | null {
    const voices = this.webVoices.filter(voice => voice.lang.startsWith(language))
    
    if (voices.length === 0) {
      return this.webVoices[0] || null
    }

    // Prefer child-friendly voices for younger users
    if (this.settings.ageGroup === 'child') {
      const childVoices = voices.filter(voice => 
        voice.name.toLowerCase().includes('child') || 
        voice.name.toLowerCase().includes('young')
      )
      if (childVoices.length > 0) {
        return childVoices[0]
      }
    }

    // Prefer local voices
    const localVoices = voices.filter(voice => voice.localService)
    if (localVoices.length > 0) {
      return localVoices[0]
    }

    return voices[0]
  }

  public stop(): void {
    // Stop web speech
    if (this.webSynthesis) {
      this.webSynthesis.cancel()
      this.currentUtterance = null
    }

    // Stop audio playback
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }

  public pause(): void {
    if (this.webSynthesis) {
      this.webSynthesis.pause()
    }
    
    if (this.currentAudio) {
      this.currentAudio.pause()
    }
  }

  public resume(): void {
    if (this.webSynthesis) {
      this.webSynthesis.resume()
    }
    
    if (this.currentAudio) {
      this.currentAudio.play()
    }
  }

  public updateSettings(newSettings: Partial<EnhancedVoiceSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
  }

  public getSettings(): EnhancedVoiceSettings {
    return { ...this.settings }
  }

  public async readLesson(lessonText: string, onProgress?: (sentence: number, total: number) => void): Promise<void> {
    const sentences = lessonText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    for (let i = 0; i < sentences.length; i++) {
      onProgress?.(i, sentences.length)
      
      await this.speak({
        text: sentences[i].trim(),
        onEnd: () => {
          // Small pause between sentences
          return new Promise(resolve => setTimeout(resolve, 500))
        }
      })
    }
  }

  // Age-appropriate voice selection
  public setAgeGroup(ageGroup: 'child' | 'adult' | 'auto'): void {
    this.settings.ageGroup = ageGroup
    
    // Auto-detect from content if set to auto
    if (ageGroup === 'auto') {
      // This could be enhanced to detect reading level from lesson content
      this.settings.ageGroup = 'child' // Default to child-friendly for education
    }
  }

  public isSupported(): boolean {
    return this.isWebSupported || 
           !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || 
           !!process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY
  }
}

export const enhancedVoiceService = new EnhancedVoiceService()