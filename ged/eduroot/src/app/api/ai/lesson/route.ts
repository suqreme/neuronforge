import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { grade_level, subject, topic, subtopic, learning_objective, estimated_duration } = await request.json()
    
    // Get the teacher prompt
    const promptResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/prompts/ai-teacher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables: {
          grade_level,
          subject,
          topic,
          subtopic,
          learning_objective,
          previous_performance: 'No previous data',
          estimated_duration
        }
      })
    })
    
    if (!promptResponse.ok) {
      throw new Error('Failed to load teacher prompt')
    }
    
    const { prompt } = await promptResponse.json()
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user", 
          content: `Please teach me about ${subtopic} in ${subject} for ${grade_level} level. Focus on the learning objective: ${learning_objective}`
        }
      ],
      temperature: 0.7,
    })

    const lessonContent = completion.choices[0].message.content || 'No lesson generated'

    return NextResponse.json({
      lesson: lessonContent,
      metadata: {
        topic,
        subtopic,
        grade_level,
        subject
      }
    })
  } catch (error) {
    console.error('Error generating lesson:', error)
    return NextResponse.json(
      { error: 'Failed to generate lesson' },
      { status: 500 }
    )
  }
}