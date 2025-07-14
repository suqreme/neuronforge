import OpenAI from 'openai'
import { promptService } from '@/services/promptService'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder-key',
})

export const generateLesson = async (variables: {
  grade_level: string
  subject: string
  topic: string
  subtopic: string
  learning_objective: string
  estimated_duration: string
}) => {
  try {
    const systemPrompt = await promptService.getTeacherPrompt(variables)
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: `Please teach me about ${variables.subtopic} in ${variables.subject} for ${variables.grade_level} level.`
        }
      ],
      temperature: 0.7,
    })

    return {
      lesson: completion.choices[0].message.content || 'No lesson generated',
      metadata: {
        topic: variables.topic,
        subtopic: variables.subtopic,
        grade_level: variables.grade_level,
        subject: variables.subject
      }
    }
  } catch (error) {
    console.error('Error generating lesson:', error)
    throw new Error('Failed to generate lesson')
  }
}

export const generateQuiz = async (variables: {
  grade_level: string
  subject: string
  topic: string
  subtopic: string
  learning_objective: string
  lesson_summary: string
}) => {
  try {
    const systemPrompt = await promptService.getQuizPrompt({
      ...variables,
      quiz_type: 'lesson_completion'
    })
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Generate a quiz for the lesson on ${variables.subtopic}. Return the response in valid JSON format.`
        }
      ],
      temperature: 0.5,
    })

    return JSON.parse(completion.choices[0].message.content || '{"questions":[],"total_points":0,"passing_score":0}')
  } catch (error) {
    console.error('Error generating quiz:', error)
    throw new Error('Failed to generate quiz')
  }
}

export const generateDiagnosticTest = async (variables: {
  estimated_grade: string
  subject: string
  target_topics: string[]
}) => {
  try {
    const systemPrompt = await promptService.getDiagnosticPrompt({
      ...variables,
      assessment_type: 'placement'
    })
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Generate a diagnostic test for placement at ${variables.estimated_grade} level in ${variables.subject}. Return valid JSON format.`
        }
      ],
      temperature: 0.3,
    })

    return JSON.parse(completion.choices[0].message.content || '{"questions":[],"placement_logic":{}}')
  } catch (error) {
    console.error('Error generating diagnostic test:', error)
    throw new Error('Failed to generate diagnostic test')
  }
}