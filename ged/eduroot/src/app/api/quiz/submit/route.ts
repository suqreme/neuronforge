import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId, lessonId, subject, topic, subtopic, answers, totalQuestions } = await request.json()

    // Validate required fields
    if (!userId || !subject || !topic || !subtopic || !answers || !totalQuestions) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate score
    let correctAnswers = 0
    if (Array.isArray(answers)) {
      // For array of user answers, compare with correct answers
      // This would need the correct answers from the lesson
      correctAnswers = answers.filter(answer => answer.isCorrect).length
    } else {
      // For object with answer details
      correctAnswers = answers.correctCount || 0
    }

    const score = Math.round((correctAnswers / totalQuestions) * 100)
    const passed = score >= 70

    // Save quiz result to database
    if (supabase) {
      const { data, error } = await supabase
        .from('quiz_results')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          subject,
          topic,
          subtopic,
          score,
          total_questions: totalQuestions,
          answers: answers,
          passed
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving quiz result:', error)
      }

      // Update user progress
      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          subject,
          grade_level: 'grade_1', // This should be passed from the request
          topic,
          subtopic,
          status: passed ? 'completed' : 'in_progress',
          score,
          attempts: 1, // This should be incremented
          completed_at: passed ? new Date().toISOString() : null
        })

      if (progressError) {
        console.error('Error updating progress:', progressError)
      }

      // Update gamification stats
      const { data: gamificationData } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (gamificationData) {
        const updatedStats = {
          ...gamificationData.stats,
          quizzesPassed: gamificationData.stats.quizzesPassed + (passed ? 1 : 0),
          perfectScores: gamificationData.stats.perfectScores + (score === 100 ? 1 : 0)
        }

        const xpGained = passed ? 50 : 10
        const newTotalXP = gamificationData.total_xp + xpGained

        await supabase
          .from('user_gamification')
          .update({
            total_xp: newTotalXP,
            stats: updatedStats
          })
          .eq('user_id', userId)
      }
    }

    return NextResponse.json({
      success: true,
      score,
      passed,
      correctAnswers,
      totalQuestions,
      message: passed ? 'Great job! You passed the quiz!' : 'Keep practicing! You can retake the quiz.'
    })

  } catch (error) {
    console.error('Quiz submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    )
  }
}