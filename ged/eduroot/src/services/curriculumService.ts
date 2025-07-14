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

  async loadSubject(subject: string): Promise<CurriculumSubject> {
    // Check cache first
    if (this.curriculumCache.has(subject)) {
      return this.curriculumCache.get(subject)!
    }

    try {
      const response = await fetch(`/api/curriculum/${subject.toLowerCase()}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const curriculum: CurriculumSubject = await response.json()
      
      // Cache the loaded curriculum
      this.curriculumCache.set(subject, curriculum)
      return curriculum
    } catch {
      throw new Error(`Failed to load curriculum for subject: ${subject}`)
    }
  }

  async getAllSubjects(): Promise<string[]> {
    try {
      const response = await fetch('/api/curriculum/subjects')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const { subjects } = await response.json()
      return subjects
    } catch {
      throw new Error('Failed to read curriculum directory')
    }
  }

  async getSubtopic(subject: string, grade: string, topic: string, subtopic: string): Promise<Subtopic | null> {
    try {
      console.log('Loading subtopic:', { subject, grade, topic, subtopic })
      const curriculum = await this.loadSubject(subject)
      console.log('Curriculum loaded:', curriculum)
      
      const gradeData = curriculum.grades[grade]
      console.log('Grade data:', gradeData)
      
      const topicData = gradeData?.topics[topic]
      console.log('Topic data:', topicData)
      
      const subtopicData = topicData?.subtopics[subtopic]
      console.log('Subtopic data:', subtopicData)
      
      return subtopicData || null
    } catch (error) {
      console.error('Error getting subtopic:', error)
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
              unlocked: this.isSubtopicUnlocked(subject, grade, topicId, subtopicId) // TODO: Pass actual user progress
            }))
        }))

      return { topics }
    } catch (error) {
      throw new Error(`Failed to get user path for ${subject} ${grade}: ${error}`)
    }
  }

  private isSubtopicUnlocked(subject: string, grade: string, topic: string, subtopic: string): boolean {
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
    } catch {
      return false
    }
  }
}

// Singleton instance
export const curriculumService = new CurriculumService()