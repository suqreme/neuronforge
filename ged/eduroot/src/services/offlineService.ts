interface OfflineLesson {
  id: string
  title: string
  subject: string
  topic: string
  subtopic: string
  content: string
  quiz: {
    questions: Array<{
      question: string
      options: string[]
      correct: number
      explanation: string
    }>
  }
  estimatedTime: string
  prerequisites: string[]
  language: string
  downloadedAt: string
  size: number // in bytes
}

interface LanguagePack {
  id: string
  language: string
  name: string
  translations: Record<string, string>
  downloadedAt: string
  size: number
}

interface OfflineContent {
  lessons: OfflineLesson[]
  languagePacks: LanguagePack[]
  voiceContent: Array<{
    id: string
    lessonId: string
    audioUrl: string
    text: string
    language: string
    downloadedAt: string
    size: number
  }>
  totalSize: number
  lastUpdated: string
}

class OfflineService {
  private storageKey = 'offline_content'
  private availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'sw', name: 'Swahili', flag: '🇰🇪' }
  ]

  getOfflineContent(): OfflineContent {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error loading offline content:', error)
    }

    return {
      lessons: [],
      languagePacks: [],
      voiceContent: [],
      totalSize: 0,
      lastUpdated: new Date().toISOString()
    }
  }

  saveOfflineContent(content: OfflineContent): void {
    try {
      content.lastUpdated = new Date().toISOString()
      localStorage.setItem(this.storageKey, JSON.stringify(content))
    } catch (error) {
      console.error('Error saving offline content:', error)
    }
  }

  // Detect user's preferred language
  detectLanguage(): string {
    // Check browser language
    const browserLang = navigator.language.split('-')[0]
    
    // Check if we support this language
    const supported = this.availableLanguages.find(lang => lang.code === browserLang)
    return supported ? browserLang : 'en'
  }

  // Generate offline lesson pack for a specific subject/topic
  async generateLessonPack(subject: string, topic: string, language: string = 'en'): Promise<OfflineLesson[]> {
    const lessons: OfflineLesson[] = []
    
    // Math lessons
    if (subject === 'math') {
      lessons.push({
        id: `math_${topic}_1`,
        title: language === 'es' ? 'Conceptos Básicos' : 'Basic Concepts',
        subject,
        topic,
        subtopic: 'fundamentals',
        content: this.generateMathContent(topic, language),
        quiz: this.generateMathQuiz(topic, language),
        estimatedTime: '15 min',
        prerequisites: [],
        language,
        downloadedAt: new Date().toISOString(),
        size: 2048 // estimated bytes
      })
    }
    
    // English lessons
    if (subject === 'english') {
      lessons.push({
        id: `english_${topic}_1`,
        title: language === 'es' ? 'Fundamentos del Inglés' : 'English Fundamentals',
        subject,
        topic,
        subtopic: 'basics',
        content: this.generateEnglishContent(topic, language),
        quiz: this.generateEnglishQuiz(topic, language),
        estimatedTime: '20 min',
        prerequisites: [],
        language,
        downloadedAt: new Date().toISOString(),
        size: 2560
      })
    }
    
    return lessons
  }

  private generateMathContent(topic: string, language: string): string {
    const content = {
      en: {
        algebra: "Algebra is the branch of mathematics that uses letters and symbols to represent numbers and quantities in formulas and equations. In this lesson, we'll explore basic algebraic concepts including variables, expressions, and simple equations.",
        geometry: "Geometry is the study of shapes, sizes, and the properties of space. We'll learn about points, lines, angles, and basic geometric shapes like triangles, rectangles, and circles.",
        arithmetic: "Arithmetic involves basic mathematical operations: addition, subtraction, multiplication, and division. These fundamental skills are essential for all advanced mathematics."
      },
      es: {
        algebra: "El álgebra es la rama de las matemáticas que usa letras y símbolos para representar números y cantidades en fórmulas y ecuaciones. En esta lección, exploraremos conceptos algebraicos básicos incluyendo variables, expresiones y ecuaciones simples.",
        geometry: "La geometría es el estudio de formas, tamaños y las propiedades del espacio. Aprenderemos sobre puntos, líneas, ángulos y formas geométricas básicas como triángulos, rectángulos y círculos.",
        arithmetic: "La aritmética involucra operaciones matemáticas básicas: suma, resta, multiplicación y división. Estas habilidades fundamentales son esenciales para todas las matemáticas avanzadas."
      }
    }

    return content[language as keyof typeof content]?.[topic as keyof typeof content.en] || content.en.arithmetic
  }

  private generateMathQuiz(topic: string, language: string) {
    const quizzes = {
      en: {
        algebra: {
          questions: [
            {
              question: "What is the value of x in the equation 2x + 5 = 15?",
              options: ["5", "10", "7.5", "3"],
              correct: 0,
              explanation: "To solve 2x + 5 = 15, subtract 5 from both sides: 2x = 10, then divide by 2: x = 5"
            },
            {
              question: "Which of the following is a variable?",
              options: ["5", "x", "+", "="],
              correct: 1,
              explanation: "A variable is a letter or symbol that represents an unknown value. In this case, 'x' is the variable."
            }
          ]
        }
      },
      es: {
        algebra: {
          questions: [
            {
              question: "¿Cuál es el valor de x en la ecuación 2x + 5 = 15?",
              options: ["5", "10", "7.5", "3"],
              correct: 0,
              explanation: "Para resolver 2x + 5 = 15, resta 5 de ambos lados: 2x = 10, luego divide por 2: x = 5"
            },
            {
              question: "¿Cuál de los siguientes es una variable?",
              options: ["5", "x", "+", "="],
              correct: 1,
              explanation: "Una variable es una letra o símbolo que representa un valor desconocido. En este caso, 'x' es la variable."
            }
          ]
        }
      }
    }

    return quizzes[language as keyof typeof quizzes]?.[topic as keyof typeof quizzes.en] || quizzes.en.algebra
  }

  private generateEnglishContent(topic: string, language: string): string {
    const content = {
      en: {
        grammar: "Grammar is the system of rules that governs how words are combined to form sentences. Understanding grammar helps us communicate clearly and effectively.",
        vocabulary: "Vocabulary refers to the words we know and use. Building a strong vocabulary improves reading comprehension and communication skills.",
        reading: "Reading comprehension is the ability to understand and interpret written text. It involves understanding main ideas, details, and making inferences."
      },
      es: {
        grammar: "La gramática es el sistema de reglas que gobierna cómo las palabras se combinan para formar oraciones. Entender la gramática nos ayuda a comunicarnos clara y efectivamente.",
        vocabulary: "El vocabulario se refiere a las palabras que conocemos y usamos. Construir un vocabulario fuerte mejora la comprensión de lectura y las habilidades de comunicación.",
        reading: "La comprensión de lectura es la habilidad de entender e interpretar texto escrito. Involucra entender ideas principales, detalles y hacer inferencias."
      }
    }

    return content[language as keyof typeof content]?.[topic as keyof typeof content.en] || content.en.grammar
  }

  private generateEnglishQuiz(topic: string, language: string) {
    const quizzes = {
      en: {
        grammar: {
          questions: [
            {
              question: "Which sentence uses correct grammar?",
              options: ["She don't like apples", "She doesn't like apples", "She not like apples", "She no like apples"],
              correct: 1,
              explanation: "The correct form uses 'doesn't' (does not) for third person singular subjects."
            },
            {
              question: "What is a noun?",
              options: ["An action word", "A describing word", "A person, place, or thing", "A connecting word"],
              correct: 2,
              explanation: "A noun is a word that represents a person, place, thing, or idea."
            }
          ]
        }
      },
      es: {
        grammar: {
          questions: [
            {
              question: "¿Cuál oración usa gramática correcta?",
              options: ["She don't like apples", "She doesn't like apples", "She not like apples", "She no like apples"],
              correct: 1,
              explanation: "La forma correcta usa 'doesn't' (does not) para sujetos en tercera persona singular."
            },
            {
              question: "¿Qué es un sustantivo?",
              options: ["Una palabra de acción", "Una palabra descriptiva", "Una persona, lugar o cosa", "Una palabra conectiva"],
              correct: 2,
              explanation: "Un sustantivo es una palabra que representa una persona, lugar, cosa o idea."
            }
          ]
        }
      }
    }

    return quizzes[language as keyof typeof quizzes]?.[topic as keyof typeof quizzes.en] || quizzes.en.grammar
  }

  // Download lesson pack
  async downloadLessonPack(subject: string, topic: string, language: string = 'en'): Promise<void> {
    const content = this.getOfflineContent()
    const newLessons = await this.generateLessonPack(subject, topic, language)
    
    // Add to offline content
    content.lessons.push(...newLessons)
    content.totalSize += newLessons.reduce((sum, lesson) => sum + lesson.size, 0)
    
    this.saveOfflineContent(content)
  }

  // Get available languages
  getAvailableLanguages() {
    return this.availableLanguages
  }

  // Get downloaded lessons
  getDownloadedLessons(): OfflineLesson[] {
    return this.getOfflineContent().lessons
  }

  // Delete offline lesson
  deleteLessonPack(lessonId: string): void {
    const content = this.getOfflineContent()
    const lessonIndex = content.lessons.findIndex(l => l.id === lessonId)
    
    if (lessonIndex !== -1) {
      const lesson = content.lessons[lessonIndex]
      content.totalSize -= lesson.size
      content.lessons.splice(lessonIndex, 1)
      this.saveOfflineContent(content)
    }
  }

  // Get storage usage
  getStorageUsage(): { used: number; total: number; percentage: number } {
    const content = this.getOfflineContent()
    const maxStorage = 50 * 1024 * 1024 // 50MB limit
    
    return {
      used: content.totalSize,
      total: maxStorage,
      percentage: (content.totalSize / maxStorage) * 100
    }
  }

  // Clear all offline content
  clearAllContent(): void {
    localStorage.removeItem(this.storageKey)
  }

  // Translate text (fallback translation)
  async translateText(text: string, targetLanguage: string): Promise<string> {
    // Basic translation mappings for common educational terms
    const translations: Record<string, Record<string, string>> = {
      es: {
        'Mathematics': 'Matemáticas',
        'English': 'Inglés',
        'Science': 'Ciencia',
        'History': 'Historia',
        'Start Lesson': 'Comenzar Lección',
        'Take Quiz': 'Tomar Examen',
        'Continue': 'Continuar',
        'Next': 'Siguiente',
        'Previous': 'Anterior',
        'Submit': 'Enviar',
        'Correct': 'Correcto',
        'Incorrect': 'Incorrecto',
        'Score': 'Puntuación',
        'Progress': 'Progreso',
        'Level': 'Nivel',
        'Dashboard': 'Panel de Control'
      },
      fr: {
        'Mathematics': 'Mathématiques',
        'English': 'Anglais',
        'Science': 'Science',
        'History': 'Histoire',
        'Start Lesson': 'Commencer la Leçon',
        'Take Quiz': 'Faire le Quiz',
        'Continue': 'Continuer',
        'Next': 'Suivant',
        'Previous': 'Précédent',
        'Submit': 'Soumettre',
        'Correct': 'Correct',
        'Incorrect': 'Incorrect',
        'Score': 'Score',
        'Progress': 'Progrès',
        'Level': 'Niveau',
        'Dashboard': 'Tableau de Bord'
      }
    }

    if (targetLanguage === 'en') return text
    
    const langTranslations = translations[targetLanguage]
    if (langTranslations && langTranslations[text]) {
      return langTranslations[text]
    }
    
    // Return original text if no translation found
    return text
  }
}

export const offlineService = new OfflineService()