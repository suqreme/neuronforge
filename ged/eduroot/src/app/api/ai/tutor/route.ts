import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { question, lesson_topic, grade_level, conversation_history, tutor_prompt } = await request.json()

    if (!question || !lesson_topic || !grade_level) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build conversation context
    const messages: any[] = [
      {
        role: 'system',
        content: tutor_prompt
      }
    ]

    // Add conversation history for context
    if (conversation_history && conversation_history.length > 0) {
      conversation_history.forEach((msg: any) => {
        messages.push({
          role: msg.role === 'student' ? 'user' : 'assistant',
          content: msg.message
        })
      })
    }

    // Add current question
    messages.push({
      role: 'user',
      content: question
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 300,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      throw new Error('No response from AI')
    }

    return NextResponse.json({
      response: response.trim(),
      topic: lesson_topic,
      grade_level: grade_level
    })

  } catch (error: any) {
    console.error('AI Tutor Error:', error)
    
    // Provide helpful fallback response
    const fallbackResponse = `That's a really good question about ${request.body?.lesson_topic || 'this topic'}! I'm having a little trouble right now, but let me encourage you to keep thinking about it. What part interests you most?`
    
    return NextResponse.json({
      response: fallbackResponse,
      topic: request.body?.lesson_topic || 'lesson',
      grade_level: request.body?.grade_level || 'student',
      fallback: true
    })
  }
}