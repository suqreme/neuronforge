'use client'

import { useState } from 'react'

interface LessonData {
  lesson: string
  metadata: {
    topic: string
    subtopic: string
    grade_level: string
    subject: string
  }
}

interface LessonContentProps {
  lessonData: LessonData
  onComplete: () => void
}

export default function LessonContent({ lessonData, onComplete }: LessonContentProps) {
  const [currentSection, setCurrentSection] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // Split lesson content into sections for better pacing
  const sections = lessonData.lesson.split('\n\n').filter(section => section.trim().length > 0)

  const goToNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1)
    } else {
      setIsComplete(true)
    }
  }

  const goToPrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Progress Bar */}
      <div className="p-6 border-b">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Lesson Progress</span>
          <span className="text-sm text-gray-600">
            {isComplete ? 'Complete!' : `${currentSection + 1} of ${sections.length}`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: isComplete ? '100%' : `${((currentSection + 1) / sections.length) * 100}%`
            }}
          ></div>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="p-6">
        {!isComplete ? (
          <div className="space-y-6">
            {/* Current Section */}
            <div className="prose max-w-none">
              <div className="text-lg leading-relaxed whitespace-pre-line">
                {sections[currentSection]}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 border-t">
              <button
                onClick={goToPrevious}
                disabled={currentSection === 0}
                className="px-4 py-2 text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed hover:text-gray-800"
              >
                ← Previous
              </button>

              <div className="text-sm text-gray-500">
                Section {currentSection + 1} of {sections.length}
              </div>

              <button
                onClick={goToNext}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                {currentSection === sections.length - 1 ? 'Finish Lesson' : 'Next →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-green-600 text-4xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Lesson Complete!</h3>
            <p className="text-gray-600 mb-6">
              Great job! You&apos;ve finished learning about {lessonData.metadata.subtopic}. 
              Now let&apos;s test your understanding with a quiz.
            </p>
            <button
              onClick={handleComplete}
              className="bg-green-600 text-white px-8 py-3 rounded-md hover:bg-green-700 text-lg"
            >
              Take the Quiz
            </button>
          </div>
        )}
      </div>

      {/* Learning Objective Reminder */}
      <div className="bg-blue-50 p-4 border-t">
        <h4 className="font-medium text-blue-900 mb-2">Learning Objective</h4>
        <p className="text-blue-800 text-sm">
          By the end of this lesson, you should be able to understand and apply concepts related to {lessonData.metadata.subtopic}.
        </p>
      </div>
    </div>
  )
}