interface TutorConversation {
  role: 'student' | 'tutor'
  message: string
  timestamp: string
}

interface TutorSession {
  lessonTopic: string
  gradeLevel: string
  conversation: TutorConversation[]
  studentLevel: string
}

class AITutorService {
  private currentSession: TutorSession | null = null

  startTutorSession(lessonTopic: string, gradeLevel: string, lessonContent: string): TutorSession {
    this.currentSession = {
      lessonTopic,
      gradeLevel,
      conversation: [],
      studentLevel: gradeLevel
    }

    // Add initial tutor greeting
    this.addTutorMessage(
      `Hi there! I'm your AI tutor. I see you're learning about ${lessonTopic}. I'm here to help you understand anything that's confusing. What would you like to know?`
    )

    return this.currentSession
  }

  async askTutor(studentQuestion: string): Promise<string> {
    if (!this.currentSession) {
      throw new Error('No tutor session active')
    }

    // Add student question to conversation
    this.addStudentMessage(studentQuestion)

    try {
      // Create AI tutor prompt
      const tutorPrompt = this.createTutorPrompt(studentQuestion)
      
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: studentQuestion,
          lesson_topic: this.currentSession.lessonTopic,
          grade_level: this.currentSession.gradeLevel,
          conversation_history: this.currentSession.conversation.slice(-6), // Last 3 exchanges
          tutor_prompt: tutorPrompt
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get tutor response')
      }

      const data = await response.json()
      const tutorResponse = data.response

      // Add tutor response to conversation
      this.addTutorMessage(tutorResponse)

      return tutorResponse
    } catch (error) {
      console.error('Error getting tutor response:', error)
      const fallbackResponse = this.getFallbackResponse(studentQuestion)
      this.addTutorMessage(fallbackResponse)
      return fallbackResponse
    }
  }

  private createTutorPrompt(studentQuestion: string): string {
    return `You are a friendly, patient AI tutor helping a ${this.currentSession?.gradeLevel} student learn about ${this.currentSession?.lessonTopic}.

PERSONALITY:
- Speak like a caring, enthusiastic teacher
- Use age-appropriate language for ${this.currentSession?.gradeLevel} level
- Be encouraging and positive
- Break down complex concepts into simple steps
- Use examples and analogies kids can relate to

TEACHING STYLE:
- Ask follow-up questions to check understanding
- Give hints rather than direct answers when possible
- Celebrate small wins and progress
- If student seems frustrated, offer encouragement
- Use "Great question!" or "That's a smart thing to ask!" frequently

STUDENT QUESTION: "${studentQuestion}"

Respond as if you're having a natural conversation with a student who just asked this question. Keep responses conversational, warm, and educational. Limit response to 2-3 sentences unless explaining a complex concept.`
  }

  private addStudentMessage(message: string) {
    if (this.currentSession) {
      this.currentSession.conversation.push({
        role: 'student',
        message,
        timestamp: new Date().toISOString()
      })
    }
  }

  private addTutorMessage(message: string) {
    if (this.currentSession) {
      this.currentSession.conversation.push({
        role: 'tutor',
        message,
        timestamp: new Date().toISOString()
      })
    }
  }

  private getFallbackResponse(question: string): string {
    const fallbacks = [
      "That's a great question! Let me think about the best way to explain this. Can you tell me what part is most confusing?",
      "I love that you're asking questions - that's how we learn! Let's break this down step by step.",
      "Excellent question! This is something many students wonder about. What do you already know about this topic?",
      "That's exactly the kind of question a good learner asks! Let me help you understand this better.",
      "Great thinking! Questions like this show you're really paying attention. What would you like to explore first?"
    ]
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }

  getCurrentSession(): TutorSession | null {
    return this.currentSession
  }

  endTutorSession(): void {
    if (this.currentSession) {
      this.addTutorMessage("Great job asking questions today! Remember, I'm always here when you need help. Keep up the awesome learning!")
    }
    this.currentSession = null
  }

  getConversationSummary(): string {
    if (!this.currentSession || this.currentSession.conversation.length === 0) {
      return "No conversation yet."
    }

    const studentQuestions = this.currentSession.conversation
      .filter(msg => msg.role === 'student')
      .length

    return `Had a great tutoring session about ${this.currentSession.lessonTopic}! Student asked ${studentQuestions} thoughtful questions.`
  }
}

export const aiTutorService = new AITutorService()