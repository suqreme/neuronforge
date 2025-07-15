'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { 
  Heart, 
  Users, 
  Globe, 
  Smartphone, 
  Download, 
  Volume2, 
  MessageCircle,
  Languages,
  ArrowLeft
} from 'lucide-react'

interface CampaignMilestone {
  goal: number
  status: 'completed' | 'in_progress' | 'upcoming'
  date?: string
  currentAmount?: number
  achievement: string
  impact?: string
  projectedImpact?: string
  testimonial?: {
    name: string
    message: string
    location: string
    photo: string
  }
  donorCount?: number
  eta?: string
  icon: any
}

const campaignMilestones: CampaignMilestone[] = [
  {
    goal: 1000,
    status: 'completed',
    date: 'January 15, 2024',
    achievement: 'Free Mobile App Access',
    impact: '2,847 students now learning on phones in rural areas',
    testimonial: {
      name: 'Maria Santos',
      location: 'Guatemala',
      message: 'Now I can study while helping my family on the farm. The mobile app changed my life - I went from failing to top of my class!',
      photo: '/api/placeholder/80/80'
    },
    donorCount: 127,
    icon: Smartphone
  },
  {
    goal: 2500,
    status: 'completed', 
    date: 'March 22, 2024',
    achievement: 'Offline Lesson Downloads',
    impact: '1,892 students in areas with poor internet can now learn anywhere',
    testimonial: {
      name: 'David Kimani',
      location: 'Kenya',
      message: 'I download lessons at the village library and study at home by candlelight. My dream of becoming a doctor is getting closer!',
      photo: '/api/placeholder/80/80'
    },
    donorCount: 203,
    icon: Download
  },
  {
    goal: 5000,
    status: 'in_progress',
    currentAmount: 4250,
    achievement: 'Premium AI Voices for Everyone',
    projectedImpact: 'All 12,000+ students worldwide get natural AI teacher voices that make learning more engaging',
    eta: 'June 15, 2024',
    icon: Volume2
  },
  {
    goal: 10000,
    status: 'upcoming',
    achievement: 'AI Tutor for Every Student',
    projectedImpact: 'Personal AI tutoring available 24/7 globally - like having a teacher in your pocket',
    icon: MessageCircle
  },
  {
    goal: 25000,
    status: 'upcoming',
    achievement: 'Multi-language Support (Spanish, French, Arabic)',
    projectedImpact: 'Reach 50,000+ students in their native languages across Latin America, Africa, and the Middle East',
    icon: Languages
  }
]

const impactStats = {
  totalStudents: 12847,
  countriesReached: 34,
  totalDonated: 67420,
  scholarshipsProvided: 156
}

function CountUp({ end, duration = 3 }: { end: number, duration?: number }) {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    const increment = end / (duration * 60) // 60fps
    const timer = setInterval(() => {
      setCount(prev => {
        if (prev >= end) {
          clearInterval(timer)
          return end
        }
        return Math.min(prev + increment, end)
      })
    }, 1000 / 60)
    
    return () => clearInterval(timer)
  }, [end, duration])
  
  return <>{Math.floor(count).toLocaleString()}</>
}

export default function CampaignPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Global Education Campaign</h1>
              <p className="text-muted-foreground">Together, we're changing lives one student at a time</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Impact Counter */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardContent className="py-8">
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-foreground mb-6">
                🌍 Our Global Impact
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    <CountUp end={impactStats.totalStudents} />
                  </div>
                  <p className="text-muted-foreground">Students Learning</p>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">
                    <CountUp end={impactStats.countriesReached} />
                  </div>
                  <p className="text-muted-foreground">Countries Reached</p>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">
                    $<CountUp end={impactStats.totalDonated} />
                  </div>
                  <p className="text-muted-foreground">Total Donated</p>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    <CountUp end={impactStats.scholarshipsProvided} />
                  </div>
                  <p className="text-muted-foreground">Scholarships Provided</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Timeline */}
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-center mb-8">
            🚀 Campaign Milestones
          </h2>
          
          {campaignMilestones.map((milestone, index) => {
            const IconComponent = milestone.icon
            return (
              <Card key={index} className={`relative overflow-hidden ${
                milestone.status === 'completed' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 
                milestone.status === 'in_progress' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400 dark:bg-blue-950/20 dark:border-blue-800' : 
                'bg-gray-50 dark:bg-gray-900/20'
              }`}>
                
                {/* Progress bar for in-progress milestone */}
                {milestone.status === 'in_progress' && milestone.currentAmount && (
                  <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-1000"
                       style={{ width: `${(milestone.currentAmount / milestone.goal) * 100}%` }} />
                )}
                
                <CardContent className="p-6">
                  <div className="flex items-start space-x-6">
                    
                    {/* Status Icon */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl ${
                      milestone.status === 'completed' ? 'bg-green-500' : 
                      milestone.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                      {milestone.status === 'completed' ? '✅' : 
                       milestone.status === 'in_progress' ? <IconComponent className="w-8 h-8" /> : 
                       <IconComponent className="w-8 h-8" />}
                    </div>

                    <div className="flex-1">
                      {/* Goal Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-foreground">
                            ${milestone.goal.toLocaleString()} Goal
                          </h3>
                          <p className="text-xl text-primary font-semibold">
                            {milestone.achievement}
                          </p>
                        </div>
                        
                        {milestone.status === 'completed' && (
                          <div className="text-right">
                            <Badge className="bg-green-500 text-white mb-2">
                              ✨ ACHIEVED
                            </Badge>
                            <p className="text-sm text-muted-foreground">{milestone.date}</p>
                          </div>
                        )}
                        
                        {milestone.status === 'in_progress' && milestone.currentAmount && (
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                              ${milestone.currentAmount.toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              of ${milestone.goal.toLocaleString()}
                            </div>
                            <Progress 
                              value={(milestone.currentAmount / milestone.goal) * 100} 
                              className="w-40 h-3"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.round((milestone.currentAmount / milestone.goal) * 100)}% complete
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Impact Statement */}
                      {milestone.impact && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-4 border border-green-200 dark:border-green-800">
                          <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center">
                            🎉 Impact Achieved
                          </h4>
                          <p className="text-foreground text-lg">{milestone.impact}</p>
                          
                          {milestone.donorCount && (
                            <p className="text-sm text-muted-foreground mt-2 flex items-center">
                              <Heart className="w-4 h-4 mr-1 text-red-500" />
                              Thanks to {milestone.donorCount} amazing donors!
                            </p>
                          )}
                        </div>
                      )}

                      {/* Student Testimonial */}
                      {milestone.testimonial && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start space-x-4">
                            <img 
                              src={milestone.testimonial.photo} 
                              alt={milestone.testimonial.name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg"
                            />
                            <div className="flex-1">
                              <p className="italic text-foreground text-lg mb-3 leading-relaxed">
                                "{milestone.testimonial.message}"
                              </p>
                              <p className="font-semibold text-primary">
                                — {milestone.testimonial.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {milestone.testimonial.location}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Projected Impact for upcoming goals */}
                      {milestone.projectedImpact && milestone.status !== 'completed' && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                            🌟 When We Reach This Goal
                          </h4>
                          <p className="text-foreground text-lg">{milestone.projectedImpact}</p>
                          {milestone.eta && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Estimated completion: {milestone.eta}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          
          {/* Call to Action */}
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 text-center border-2 border-primary/20">
            <CardContent className="py-12">
              <h3 className="text-3xl font-bold mb-4 text-foreground">
                Help Us Reach the Next Milestone! 🚀
              </h3>
              <p className="text-xl mb-8 text-muted-foreground max-w-2xl mx-auto">
                Every donation brings premium education closer to students who need it most. 
                Your contribution today could be the difference between a student giving up or achieving their dreams.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="px-8 py-4 text-lg">
                  <Heart className="w-5 h-5 mr-2" />
                  Donate Now & Change Lives
                </Button>
                <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                  <Users className="w-5 h-5 mr-2" />
                  Share Our Mission
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mt-6">
                🔒 Secure donation processing • 💯 100% goes to education • 📊 Full transparency
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}