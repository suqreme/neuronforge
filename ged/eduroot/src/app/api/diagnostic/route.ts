import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId, estimatedGrade, subject } = await request.json()

    // Validate required fields
    if (!userId || !estimatedGrade || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if we have OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Generate diagnostic questions
    const diagnosticPrompt = `
Create a diagnostic test to determine the appropriate grade level for a student in ${subject}.

The student thinks they are at ${estimatedGrade} level.

Create 5 questions that test progressively from basic concepts to ${estimatedGrade} level.
Each question should help determine if the student is ready for that grade level.

Format as JSON:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A option", "B option", "C option", "D option"],
      "correct": 0,
      "gradeLevel": "grade_1",
      "concept": "Basic addition"
    }
  ]
}

Questions should cover:
- Basic foundational concepts
- Grade-appropriate problem solving
- Critical thinking for the subject
- Practical application

Make questions clear and age-appropriate.
`

    const diagnosticResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational assessor who creates diagnostic tests to determine appropriate grade placement for students.'
        },
        {
          role: 'user',
          content: diagnosticPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })

    let diagnosticData
    try {
      diagnosticData = JSON.parse(diagnosticResponse.choices[0]?.message?.content || '{}')
    } catch (error) {
      // Fallback diagnostic if JSON parsing fails
      diagnosticData = {
        questions: [
          {
            question: `What is 2 + 2?`,
            options: ['3', '4', '5', '6'],
            correct: 1,
            gradeLevel: 'kindergarten',
            concept: 'Basic addition'
          },
          {
            question: `What is 5 + 3?`,
            options: ['7', '8', '9', '10'],
            correct: 1,
            gradeLevel: 'grade_1',
            concept: 'Single digit addition'
          }
        ]
      }
    }

    return NextResponse.json({
      diagnostic: diagnosticData,
      subject,
      estimatedGrade
    })

  } catch (error) {
    console.error('Diagnostic generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate diagnostic test' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, answers, subject, estimatedGrade } = await request.json()

    // Validate required fields
    if (!userId || !answers || !subject || !estimatedGrade) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Analyze answers to determine placement
    let correctAnswers = 0
    let highestCorrectGrade = 'kindergarten'
    
    if (Array.isArray(answers)) {
      answers.forEach((answer, index) => {
        if (answer.isCorrect) {
          correctAnswers++
          // Track highest grade level answered correctly
          if (answer.gradeLevel && answer.gradeLevel > highestCorrectGrade) {
            highestCorrectGrade = answer.gradeLevel
          }
        }
      })
    }

    // Determine placement based on performance
    let placementLevel = 'kindergarten'
    const percentage = (correctAnswers / answers.length) * 100

    if (percentage >= 80) {
      placementLevel = estimatedGrade
    } else if (percentage >= 60) {
      placementLevel = highestCorrectGrade
    } else {
      // Place one level below highest correct
      const gradeOrder = ['kindergarten', 'grade_1', 'grade_2', 'grade_3']
      const currentIndex = gradeOrder.indexOf(highestCorrectGrade)
      placementLevel = gradeOrder[Math.max(0, currentIndex - 1)]
    }

    // Save placement to database
    if (supabase) {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          placement_level: placementLevel
        })
        .eq('id', userId)

      if (error) {
        console.error('Error saving placement:', error)
      }
    }

    return NextResponse.json({
      success: true,
      placementLevel,
      score: percentage,
      correctAnswers,
      totalQuestions: answers.length,
      message: `Based on your performance, you've been placed at ${placementLevel.replace('_', ' ')} level.`
    })

  } catch (error) {
    console.error('Diagnostic submission error:', error)
    return NextResponse.json(
      { error: 'Failed to process diagnostic results' },
      { status: 500 }
    )
  }
}