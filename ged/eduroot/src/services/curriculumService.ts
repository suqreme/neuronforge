import { promises as fs } from 'fs'
import path from 'path'

export interface CurriculumNode {
  name: string
  order: number
  learning_objective?: string
  prerequisites?: string[]
  estimated_duration?: string
}

export interface Subtopic extends CurriculumNode {
  learning_objective: string
  prerequisites: string[]
  estimated_duration: string
}

export interface Topic extends CurriculumNode {
  subtopics: Record<string, Subtopic>
}

export interface Grade extends CurriculumNode {
  topics: Record<string, Topic>
}

export interface CurriculumSubject {
  subject: string
  grades: Record<string, Grade>
}

export class CurriculumService {
  private curriculumCache: Map<string, CurriculumSubject> = new Map()
  private curriculumPath = path.join(process.cwd(), 'curriculum')

  async loadSubject(subject: string): Promise<CurriculumSubject> {
    // Check cache first
    if (this.curriculumCache.has(subject)) {
      return this.curriculumCache.get(subject)!
    }

    try {
      const filePath = path.join(this.curriculumPath, `${subject.toLowerCase()}.json`)
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const curriculum: CurriculumSubject = JSON.parse(fileContent)
      
      // Cache the loaded curriculum
      this.curriculumCache.set(subject, curriculum)
      return curriculum
    } catch (error) {
      throw new Error(`Failed to load curriculum for subject: ${subject}`)
    }
  }

  async getAllSubjects(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.curriculumPath)
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
    } catch (error) {
      throw new Error('Failed to read curriculum directory')
    }
  }

  async getSubtopic(subject: string, grade: string, topic: string, subtopic: string): Promise<Subtopic | null> {
    try {
      const curriculum = await this.loadSubject(subject)
      return curriculum.grades[grade]?.topics[topic]?.subtopics[subtopic] || null
    } catch (error) {
      return null
    }
  }

  async getUserPath(subject: string, grade: string): Promise<{topics: Array<{id: string, name: string, subtopics: Array<{id: string, name: string, unlocked: boolean}>}>}> {
    try {
      const curriculum = await this.loadSubject(subject)
      const gradeData = curriculum.grades[grade]
      
      if (!gradeData) {
        throw new Error(`Grade ${grade} not found in ${subject} curriculum`)
      }

      const topics = Object.entries(gradeData.topics)
        .sort(([,a], [,b]) => a.order - b.order)
        .map(([topicId, topicData]) => ({
          id: topicId,
          name: topicData.name,
          subtopics: Object.entries(topicData.subtopics)
            .sort(([,a], [,b]) => a.order - b.order)
            .map(([subtopicId, subtopicData]) => ({
              id: subtopicId,
              name: subtopicData.name,
              unlocked: this.isSubtopicUnlocked(subject, grade, topicId, subtopicId, []) // TODO: Pass actual user progress
            }))
        }))

      return { topics }
    } catch (error) {
      throw new Error(`Failed to get user path for ${subject} ${grade}: ${error}`)
    }
  }

  private isSubtopicUnlocked(subject: string, grade: string, topic: string, subtopic: string, completedSubtopics: string[]): boolean {
    // For now, unlock the first subtopic of the first topic
    // In a real implementation, this would check prerequisites against user progress
    const isFirstTopicFirstSubtopic = topic === Object.keys(this.curriculumCache.get(subject)?.grades[grade]?.topics || {})[0]
    
    if (isFirstTopicFirstSubtopic) {
      const firstSubtopic = Object.keys(this.curriculumCache.get(subject)?.grades[grade]?.topics[topic]?.subtopics || {})[0]
      return subtopic === firstSubtopic
    }
    
    return false
  }

  async validatePrerequisites(subject: string, grade: string, topic: string, subtopic: string, userProgress: string[]): Promise<boolean> {
    try {
      const subtopicData = await this.getSubtopic(subject, grade, topic, subtopic)
      if (!subtopicData || !subtopicData.prerequisites) {
        return true // No prerequisites means it's available
      }

      // Check if all prerequisites are in user's completed list
      return subtopicData.prerequisites.every(prereq => userProgress.includes(prereq))
    } catch (error) {
      return false
    }
  }
}

// Singleton instance
export const curriculumService = new CurriculumService()