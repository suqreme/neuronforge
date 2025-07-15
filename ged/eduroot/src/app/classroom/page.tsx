'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Plus, Users, UserX, RotateCcw } from 'lucide-react'

interface Student {
  id: string
  nickname: string
  grade: string
  subject: string
  progress: {
    lessonsCompleted: number
    totalXP: number
    currentStreak: number
  }
  lastActivity: string
  created: string
}

export default function ClassroomMode() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('grade_1')

  useEffect(() => {
    loadClassroomStudents()
  }, [])

  const loadClassroomStudents = () => {
    const classroomData = localStorage.getItem('classroom_students')
    if (classroomData) {
      setStudents(JSON.parse(classroomData))
    }
  }

  const saveClassroomStudents = (updatedStudents: Student[]) => {
    localStorage.setItem('classroom_students', JSON.stringify(updatedStudents))
    setStudents(updatedStudents)
  }

  const addStudent = () => {
    if (!newStudentName.trim()) return

    const newStudent: Student = {
      id: `student_${Date.now()}`,
      nickname: newStudentName.trim(),
      grade: selectedGrade,
      subject: 'math',
      progress: {
        lessonsCompleted: 0,
        totalXP: 0,
        currentStreak: 0
      },
      lastActivity: new Date().toISOString(),
      created: new Date().toISOString()
    }

    const updatedStudents = [...students, newStudent]
    saveClassroomStudents(updatedStudents)
    setNewStudentName('')
    setShowAddForm(false)
  }

  const removeStudent = (studentId: string) => {
    if (confirm('Are you sure you want to remove this student?')) {
      const updatedStudents = students.filter(s => s.id !== studentId)
      saveClassroomStudents(updatedStudents)
      
      // Clean up student's individual progress
      localStorage.removeItem(`onboarding_${studentId}`)
      localStorage.removeItem(`placement_${studentId}`)
      localStorage.removeItem(`progress_${studentId}`)
    }
  }

  const clearAllStudents = () => {
    if (confirm('Are you sure you want to clear all students? This will delete all their progress.')) {
      // Clean up all student data
      students.forEach(student => {
        localStorage.removeItem(`onboarding_${student.id}`)
        localStorage.removeItem(`placement_${student.id}`)
        localStorage.removeItem(`progress_${student.id}`)
      })
      
      localStorage.removeItem('classroom_students')
      setStudents([])
    }
  }

  const switchToStudent = (student: Student) => {
    // Create a temporary user session for this student
    const tempUser = {
      id: student.id,
      email: `${student.nickname}@classroom.local`,
      user_metadata: {
        nickname: student.nickname
      }
    }
    
    // Store the current classroom student
    localStorage.setItem('current_classroom_student', JSON.stringify(tempUser))
    
    // Mark as completed onboarding and set placement
    localStorage.setItem(`onboarding_${student.id}`, 'true')
    localStorage.setItem(`placement_${student.id}`, student.grade.replace('_', ' '))
    
    // Navigate to dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Classroom Mode</h1>
              <p className="text-muted-foreground">Manage multiple students on one device</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {students.length} Students
              </Badge>
              <ThemeToggle />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/')}
              >
                Exit Classroom
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Actions */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-semibold text-foreground">Students</h2>
          <div className="flex space-x-4">
            {students.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearAllStudents}
                className="text-destructive hover:text-destructive"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        </div>

        {/* Add Student Form */}
        {showAddForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add New Student</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Student Nickname
                  </label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Enter student name or nickname"
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Starting Grade Level
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="kindergarten">Kindergarten</option>
                    <option value="grade_1">1st Grade</option>
                    <option value="grade_2">2nd Grade</option>
                    <option value="grade_3">3rd Grade</option>
                  </select>
                </div>
                <div className="flex space-x-4">
                  <Button onClick={addStudent}>Add Student</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Students Grid */}
        {students.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Students Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add students to start using classroom mode. Each student will have their own progress tracked separately.
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Student
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student) => (
              <Card key={student.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{student.nickname}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {student.grade.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudent(student.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lessons:</span>
                      <span className="font-medium">{student.progress.lessonsCompleted}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">XP:</span>
                      <span className="font-medium">{student.progress.totalXP}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Streak:</span>
                      <span className="font-medium">{student.progress.currentStreak} days</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Added: {new Date(student.created).toLocaleDateString()}
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => switchToStudent(student)}
                    >
                      Switch to {student.nickname}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How Classroom Mode Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Each student gets their own profile with separate progress tracking</p>
              <p>• Students can be added with nicknames to protect privacy</p>
              <p>• All data is stored locally on this device</p>
              <p>• Use "Export Progress" (coming soon) to backup student data</p>
              <p>• Perfect for shared computers in libraries, schools, or community centers</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}