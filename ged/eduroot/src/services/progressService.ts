interface LessonProgress {
  userId: string
  subject: string
  grade: string
  topic: string
  subtopic: string
  completed: boolean
  score?: number
  attempts: number
  lastAccessed: string
  timeSpent: number // in minutes
}

interface UserStats {
  lessonsCompleted: number
  quizzesPassed: number
  totalXP: number
  currentStreak: number
  lastLessonDate: string
}

export class ProgressService {
  private getStorageKey(userId: string, type: string): string {
    return `eduroot_${type}_${userId}`
  }

  // Save lesson completion
  saveProgress(progress: LessonProgress): void {
    const key = this.getStorageKey(progress.userId, 'progress')
    const existingProgress = this.getAllProgress(progress.userId)
    
    const progressKey = `${progress.subject}_${progress.grade}_${progress.topic}_${progress.subtopic}`
    existingProgress[progressKey] = progress
    
    localStorage.setItem(key, JSON.stringify(existingProgress))
    
    // Update user stats
    this.updateUserStats(progress.userId)
  }

  // Get all progress for a user
  getAllProgress(userId: string): Record<string, LessonProgress> {
    const key = this.getStorageKey(userId, 'progress')
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : {}
  }

  // Get progress for specific lesson
  getLessonProgress(userId: string, subject: string, grade: string, topic: string, subtopic: string): LessonProgress | null {
    const allProgress = this.getAllProgress(userId)
    const progressKey = `${subject}_${grade}_${topic}_${subtopic}`
    return allProgress[progressKey] || null
  }

  // Check if lesson is completed
  isLessonCompleted(userId: string, subject: string, grade: string, topic: string, subtopic: string): boolean {
    const progress = this.getLessonProgress(userId, subject, grade, topic, subtopic)
    return progress?.completed || false
  }

  // Get completed lessons for a subject/grade
  getCompletedLessons(userId: string, subject: string, grade: string): string[] {
    const allProgress = this.getAllProgress(userId)
    const completed: string[] = []
    
    Object.values(allProgress).forEach(progress => {
      if (progress.subject === subject && 
          progress.grade === grade && 
          progress.completed) {
        completed.push(`${progress.topic}_${progress.subtopic}`)
      }
    })
    
    return completed
  }

  // Determine which lessons should be unlocked
  getUnlockedLessons(userId: string, subject: string, grade: string): string[] {
    const completed = this.getCompletedLessons(userId, subject, grade)
    const unlocked = ['counting_numbers_1_10'] // Always unlock first lesson
    
    // Simple unlock logic: unlock next lesson when previous is completed
    const lessonOrder = [
      'counting_numbers_1_10',
      'counting_counting_objects',
      'basic_shapes_circle_square_triangle',
      'addition_subtraction_addition_within_10',
      'addition_subtraction_subtraction_within_10',
      'place_value_tens_and_ones'
    ]
    
    lessonOrder.forEach((lesson, index) => {
      if (index > 0 && completed.includes(lessonOrder[index - 1])) {
        unlocked.push(lesson)
      }
    })
    
    return unlocked
  }

  // Get last accessed lesson for resume functionality
  getLastLesson(userId: string): LessonProgress | null {
    const allProgress = this.getAllProgress(userId)
    const progressArray = Object.values(allProgress)
    
    if (progressArray.length === 0) return null
    
    // Sort by last accessed date
    progressArray.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
    
    // Return the most recent incomplete lesson, or most recent completed if all complete
    const incompleteLesson = progressArray.find(p => !p.completed)
    return incompleteLesson || progressArray[0]
  }

  // Update user stats
  private updateUserStats(userId: string): void {
    const allProgress = this.getAllProgress(userId)
    const completedLessons = Object.values(allProgress).filter(p => p.completed)
    const passedQuizzes = completedLessons.filter(p => (p.score || 0) >= 70)
    
    const stats: UserStats = {
      lessonsCompleted: completedLessons.length,
      quizzesPassed: passedQuizzes.length,
      totalXP: completedLessons.reduce((xp, lesson) => xp + (lesson.score || 0), 0),
      currentStreak: this.calculateStreak(completedLessons),
      lastLessonDate: completedLessons.length > 0 
        ? completedLessons[completedLessons.length - 1].lastAccessed
        : ''
    }
    
    const key = this.getStorageKey(userId, 'stats')
    localStorage.setItem(key, JSON.stringify(stats))
  }

  // Get user statistics
  getUserStats(userId: string): UserStats {
    const key = this.getStorageKey(userId, 'stats')
    const stored = localStorage.getItem(key)
    
    if (stored) {
      return JSON.parse(stored)
    }
    
    // Return default stats
    return {
      lessonsCompleted: 0,
      quizzesPassed: 0,
      totalXP: 0,
      currentStreak: 0,
      lastLessonDate: ''
    }
  }

  // Calculate learning streak
  private calculateStreak(completedLessons: LessonProgress[]): number {
    if (completedLessons.length === 0) return 0
    
    // Sort lessons by date
    const sorted = completedLessons.sort((a, b) => 
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    )
    
    let streak = 1
    const oneDay = 24 * 60 * 60 * 1000
    
    for (let i = sorted.length - 1; i > 0; i--) {
      const current = new Date(sorted[i].lastAccessed)
      const previous = new Date(sorted[i - 1].lastAccessed)
      const daysDiff = (current.getTime() - previous.getTime()) / oneDay
      
      if (daysDiff <= 2) { // Allow 1-2 day gaps
        streak++
      } else {
        break
      }
    }
    
    return streak
  }

  // Start a lesson (track access time)
  startLesson(userId: string, subject: string, grade: string, topic: string, subtopic: string): void {
    const existing = this.getLessonProgress(userId, subject, grade, topic, subtopic)
    
    const progress: LessonProgress = {
      userId,
      subject,
      grade,
      topic,
      subtopic,
      completed: existing?.completed || false,
      score: existing?.score,
      attempts: (existing?.attempts || 0) + 1,
      lastAccessed: new Date().toISOString(),
      timeSpent: existing?.timeSpent || 0
    }
    
    this.saveProgress(progress)
  }

  // Complete a lesson with quiz score
  completeLesson(userId: string, subject: string, grade: string, topic: string, subtopic: string, score: number, timeSpent: number): void {
    const progress: LessonProgress = {
      userId,
      subject,
      grade,
      topic,
      subtopic,
      completed: true,
      score,
      attempts: this.getLessonProgress(userId, subject, grade, topic, subtopic)?.attempts || 1,
      lastAccessed: new Date().toISOString(),
      timeSpent
    }
    
    this.saveProgress(progress)
  }

  // Clear all progress (for demo reset)
  clearProgress(userId: string): void {
    const progressKey = this.getStorageKey(userId, 'progress')
    const statsKey = this.getStorageKey(userId, 'stats')
    
    localStorage.removeItem(progressKey)
    localStorage.removeItem(statsKey)
  }
}

// Singleton instance
export const progressService = new ProgressService()