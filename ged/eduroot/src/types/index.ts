// User types
export interface User {
  id: string
  email?: string
  country?: string
  isAnonymous: boolean
  subscription_status: 'free' | 'paid' | 'hardship'
  created_at: string
}

// Curriculum types
export interface Grade {
  id: string
  name: string
  order: number
  subjects: Subject[]
}

export interface Subject {
  id: string
  grade_id: string
  name: string
  order: number
  topics: Topic[]
}

export interface Topic {
  id: string
  subject_id: string
  name: string
  order: number
  subtopics: Subtopic[]
}

export interface Subtopic {
  id: string
  topic_id: string
  name: string
  order: number
  is_unlocked: boolean
}

// Progress types
export interface UserProgress {
  id: string
  user_id: string
  current_grade_id: string
  current_subject_id: string
  current_topic_id: string
  current_subtopic_id: string
  placement_level: string
  total_xp: number
  badges: string[]
}

// Lesson types
export interface Lesson {
  id: string
  content: string
  quiz: QuizQuestion[]
  notes?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
}

export interface QuizResult {
  id: string
  user_id: string
  subtopic_id: string
  score: number
  answers: number[]
  passed: boolean
  attempt_number: number
  created_at: string
}