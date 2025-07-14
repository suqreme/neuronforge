import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder-key',
})

export async function POST(request: NextRequest) {
  try {
    const { estimated_grade, subject, target_topics } = await request.json()
    
    // Get the diagnostic prompt
    const promptResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/prompts/diagnostic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables: {
          estimated_grade,
          subject,
          assessment_type: 'placement',
          target_topics: target_topics.join(', ')
        }
      })
    })
    
    if (!promptResponse.ok) {
      throw new Error('Failed to load diagnostic prompt')
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
          content: `Generate a diagnostic test for placement at ${estimated_grade} level in ${subject}. Return valid JSON format.`
        }
      ],
      temperature: 0.3,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{"questions":[],"placement_logic":{}}')
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error generating diagnostic test:', error)
    return NextResponse.json(
      { error: 'Failed to generate diagnostic test' },
      { status: 500 }
    )
  }
}