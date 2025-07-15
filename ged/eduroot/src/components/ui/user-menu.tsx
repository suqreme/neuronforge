'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { User, LogOut, Settings, Crown, GraduationCap } from 'lucide-react'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/')
    }
  }

  const isClassroomUser = user.email?.includes('@classroom.local')
  const isAdmin = user.email === 'admin@eduroot.com'

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2"
      >
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          {isAdmin ? (
            <Crown className="w-4 h-4 text-primary" />
          ) : (
            <User className="w-4 h-4 text-primary" />
          )}
        </div>
        <span className="hidden sm:inline text-sm">
          {user.email?.split('@')[0] || 'User'}
        </span>
      </Button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <Card className="absolute right-0 top-full mt-2 w-64 z-50 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-center space-x-3 pb-3 border-b">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    {isAdmin ? (
                      <Crown className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {user.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isAdmin ? 'Administrator' : isClassroomUser ? 'Classroom Student' : 'Student'}
                    </p>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      router.push('/dashboard')
                      setShowDropdown(false)
                    }}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      router.push('/achievements')
                      setShowDropdown(false)
                    }}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Achievements
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        router.push('/admin')
                        setShowDropdown(false)
                      }}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
                  )}

                  {isClassroomUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        localStorage.removeItem('current_classroom_student')
                        router.push('/classroom')
                        setShowDropdown(false)
                      }}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Back to Classroom
                    </Button>
                  )}

                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-orange-600"
                      onClick={() => {
                        if (user) {
                          localStorage.removeItem(`onboarding_${user.id}`)
                          localStorage.removeItem(`placement_${user.id}`)
                          // Clear progress if progressService is available
                          try {
                            const { progressService } = require('@/services/progressService')
                            progressService.clearProgress(user.id)
                          } catch (e) {
                            console.log('Could not clear progress:', e)
                          }
                        }
                        router.push('/')
                        setShowDropdown(false)
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Reset Demo
                    </Button>
                  )}
                </div>

                {/* Logout */}
                <div className="pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}