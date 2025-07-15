'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          What grade level do you think you&apos;re at?
        </CardTitle>
      </CardHeader>
      <CardContent>
      
      <p className="text-muted-foreground text-center mb-6">
        Don&apos;t worry if you&apos;re not sure! We&apos;ll test your knowledge to find the perfect starting point.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {grades.map((grade) => (
            <label key={grade} className="flex items-center cursor-pointer hover:bg-accent/50 p-2 transition-colors">
              <input
                type="radio"
                name="grade"
                value={grade}
                checked={selectedGrade === grade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="mr-3 text-primary accent-primary"
              />
              <span className="text-foreground">{grade}</span>
            </label>
          ))}
        </div>

        <Button
          type="submit"
          disabled={!selectedGrade}
          className="w-full"
        >
          Start Diagnostic Test
        </Button>
      </form>
      </CardContent>
    </Card>
  )
}