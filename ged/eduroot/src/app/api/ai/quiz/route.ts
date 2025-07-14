import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { grade_level, subject, topic, subtopic, learning_objective, lesson_summary } = await request.json()
    
    // Get the quiz generator prompt
    const promptResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/prompts/quiz-generator`, {
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
          lesson_summary,
          quiz_type: 'lesson_completion'
        }
      })
    })
    
    if (!promptResponse.ok) {
      throw new Error('Failed to load quiz prompt')
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
          content: `Generate a quiz for the lesson on ${subtopic} in ${subject} for ${grade_level}. Focus on testing: ${learning_objective}. Return the response in valid JSON format.`
        }
      ],
      temperature: 0.5,
    })

    const quizContent = completion.choices[0].message.content || '{}'
    
    try {
      const quizData = JSON.parse(quizContent)
      
      // Ensure the quiz has the expected structure
      const formattedQuiz = {
        questions: quizData.questions || [],
        total_points: quizData.total_points || quizData.questions?.length || 0,
        passing_score: quizData.passing_score || Math.ceil((quizData.questions?.length || 0) * 0.7),
        time_estimate: quizData.time_estimate || '5-10 minutes'
      }

      return NextResponse.json(formattedQuiz)
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError)
      
      // Fallback quiz if JSON parsing fails
      const fallbackQuiz = {
        questions: [
          {
            id: 1,
            question: `What did you learn about ${subtopic}?`,
            type: "multiple_choice",
            options: ["I understand the concept", "I need more practice", "I'm confused", "I want to review"],
            correct_answer: 0,
            explanation: "Great! Understanding the concept is the first step to mastering it.",
            points: 1,
            difficulty: "grade_level"
          }
        ],
        total_points: 1,
        passing_score: 1,
        time_estimate: "2 minutes"
      }
      
      return NextResponse.json(fallbackQuiz)
    }
  } catch (error) {
    console.error('Error generating quiz:', error)
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}