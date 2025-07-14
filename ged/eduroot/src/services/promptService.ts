import { promises as fs } from 'fs'
import path from 'path'

export interface PromptVariables {
  [key: string]: string | number | object
}

export class PromptService {
  private promptCache: Map<string, string> = new Map()
  private promptsPath = path.join(process.cwd(), 'prompts')

  async loadPrompt(promptName: string): Promise<string> {
    // Check cache first
    if (this.promptCache.has(promptName)) {
      return this.promptCache.get(promptName)!
    }

    try {
      const filePath = path.join(this.promptsPath, `${promptName}.md`)
      const content = await fs.readFile(filePath, 'utf-8')
      
      // Cache the loaded prompt
      this.promptCache.set(promptName, content)
      return content
    } catch (error) {
      throw new Error(`Failed to load prompt: ${promptName}`)
    }
  }

  async renderPrompt(promptName: string, variables: PromptVariables): Promise<string> {
    try {
      let prompt = await this.loadPrompt(promptName)
      
      // Replace variables in the format {{variable_name}}
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`
        const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
        prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement)
      }

      return prompt
    } catch (error) {
      throw new Error(`Failed to render prompt ${promptName}: ${error}`)
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
    try {
      const files = await fs.readdir(this.promptsPath)
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''))
    } catch (error) {
      throw new Error('Failed to list available prompts')
    }
  }

  // Clear cache - useful for development/testing
  clearCache(): void {
    this.promptCache.clear()
  }
}

// Singleton instance
export const promptService = new PromptService()