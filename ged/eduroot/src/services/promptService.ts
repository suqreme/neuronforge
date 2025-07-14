export interface PromptVariables {
  [key: string]: string | number | object
}

export class PromptService {
  private promptCache: Map<string, string> = new Map()

  async renderPrompt(promptName: string, variables: PromptVariables): Promise<string> {
    try {
      const response = await fetch(`/api/prompts/${promptName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variables })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const { prompt } = await response.json()
      return prompt
    } catch {
      throw new Error(`Failed to render prompt ${promptName}`)
    }
  }

  async getTeacherPrompt(variables: {
    grade_level: string
    subject: string
    topic: string
    subtopic: string
    learning_objective: string
    previous_performance?: string
    estimated_duration: string
  }): Promise<string> {
    return this.renderPrompt('ai-teacher', {
      ...variables,
      previous_performance: variables.previous_performance || 'No previous data'
    })
  }

  async getDiagnosticPrompt(variables: {
    estimated_grade: string
    subject: string
    assessment_type: 'placement' | 'progress_check' | 'remediation'
    target_topics: string[]
  }): Promise<string> {
    return this.renderPrompt('diagnostic', {
      ...variables,
      target_topics: variables.target_topics.join(', ')
    })
  }

  async getQuizPrompt(variables: {
    grade_level: string
    subject: string
    topic: string
    subtopic: string
    learning_objective: string
    lesson_summary: string
    quiz_type: 'lesson_completion' | 'review' | 'mastery_check'
  }): Promise<string> {
    return this.renderPrompt('quiz-generator', variables)
  }

  async getReviewPrompt(variables: {
    grade_level: string
    subject: string
    review_topics: string[]
    performance_data: object
    review_type: 'spaced_repetition' | 'mistake_remediation' | 'comprehensive_review'
    time_estimate: string
  }): Promise<string> {
    return this.renderPrompt('reviewer', {
      ...variables,
      review_topics: variables.review_topics.join(', ')
    })
  }

  async getFeedbackPrompt(variables: {
    student_name?: string
    grade_level: string
    subject: string
    topic: string
    subtopic: string
    quiz_results: object
    lesson_engagement: string
    performance_history: object
    learning_objective: string
  }): Promise<string> {
    return this.renderPrompt('feedback', {
      ...variables,
      student_name: variables.student_name || 'Student'
    })
  }

  async listAvailablePrompts(): Promise<string[]> {
    // Return known prompts for now
    return ['ai-teacher', 'diagnostic', 'quiz-generator', 'reviewer', 'feedback']
  }

  // Clear cache - useful for development/testing
  clearCache(): void {
    this.promptCache.clear()
  }
}

// Singleton instance
export const promptService = new PromptService()