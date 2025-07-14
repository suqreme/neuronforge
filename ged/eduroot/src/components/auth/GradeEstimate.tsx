'use client'

import { useState } from 'react'

interface GradeEstimateProps {
  onGradeSelected: (grade: string) => void
}

const grades = [
  'Kindergarten',
  '1st Grade',
  '2nd Grade', 
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade'
]

export default function GradeEstimate({ onGradeSelected }: GradeEstimateProps) {
  const [selectedGrade, setSelectedGrade] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedGrade) {
      onGradeSelected(selectedGrade)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-center mb-6">
        What grade level do you think you&apos;re at?
      </h2>
      
      <p className="text-gray-600 text-center mb-6">
        Don&apos;t worry if you&apos;re not sure! We&apos;ll test your knowledge to find the perfect starting point.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {grades.map((grade) => (
            <label key={grade} className="flex items-center">
              <input
                type="radio"
                name="grade"
                value={grade}
                checked={selectedGrade === grade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="mr-3 text-blue-600"
              />
              <span className="text-gray-700">{grade}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={!selectedGrade}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Diagnostic Test
        </button>
      </form>
    </div>
  )
}