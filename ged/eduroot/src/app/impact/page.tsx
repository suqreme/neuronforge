'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { MapPin, Users, Heart, Globe, Camera, Mail, Phone } from 'lucide-react'

interface EducationCenter {
  id: string
  name: string
  location: {
    country: string
    city: string
    coordinates: [number, number] // [lat, lng]
  }
  story: string
  studentsServed: number
  donorName?: string
  photos: string[]
  contactEmail: string
  establishedDate: string
  status: 'active' | 'requesting' | 'funded'
  monthlyImpact: {
    newStudents: number
    lessonsCompleted: number
    certificatesEarned: number
  }
}

interface DonationStats {
  totalCenters: number
  totalStudents: number
  totalDonors: number
  countriesReached: number
}

export default function ImpactPage() {
  const router = useRouter()
  const [centers, setCenters] = useState<EducationCenter[]>([])
  const [stats, setStats] = useState<DonationStats>({
    totalCenters: 0,
    totalStudents: 0,
    totalDonors: 0,
    countriesReached: 0
  })
  const [selectedCenter, setSelectedCenter] = useState<EducationCenter | null>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)

  useEffect(() => {
    loadImpactData()
  }, [])

  const loadImpactData = () => {
    // Demo data - in real app, this would come from API
    const demoCenters: EducationCenter[] = [
      {
        id: '1',
        name: 'Kibera Learning Hub',
        location: {
          country: 'Kenya',
          city: 'Nairobi',
          coordinates: [-1.2921, 36.8219]
        },
        story: 'Started in 2023, this center serves students in one of Nairobi\'s largest urban slums. Thanks to donor support, we\'ve provided computers and internet access to help students learn math and English.',
        studentsServed: 45,
        donorName: 'Tech for Good Foundation',
        photos: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
        contactEmail: 'kibera@eduroot.org',
        establishedDate: '2023-08-15',
        status: 'active',
        monthlyImpact: {
          newStudents: 8,
          lessonsCompleted: 234,
          certificatesEarned: 12
        }
      },
      {
        id: '2',
        name: 'Rural Guatemala Education Center',
        location: {
          country: 'Guatemala',
          city: 'San Marcos',
          coordinates: [14.9667, -91.8]
        },
        story: 'This center serves indigenous Mayan communities in rural Guatemala. Students learn both Spanish and English while preserving their cultural heritage.',
        studentsServed: 32,
        donorName: 'Anonymous Donor',
        photos: ['/api/placeholder/400/300'],
        contactEmail: 'guatemala@eduroot.org',
        establishedDate: '2023-06-20',
        status: 'active',
        monthlyImpact: {
          newStudents: 5,
          lessonsCompleted: 156,
          certificatesEarned: 8
        }
      },
      {
        id: '3',
        name: 'Syrian Refugee Learning Center',
        location: {
          country: 'Jordan',
          city: 'Amman',
          coordinates: [31.9539, 35.9106]
        },
        story: 'Supporting Syrian refugee families with essential education. Many students here are working toward their high school equivalency while learning valuable life skills.',
        studentsServed: 67,
        donorName: 'Global Education Alliance',
        photos: ['/api/placeholder/400/300', '/api/placeholder/400/300'],
        contactEmail: 'jordan@eduroot.org',
        establishedDate: '2023-04-10',
        status: 'active',
        monthlyImpact: {
          newStudents: 12,
          lessonsCompleted: 345,
          certificatesEarned: 18
        }
      },
      {
        id: '4',
        name: 'Rural Philippines Community Center',
        location: {
          country: 'Philippines',
          city: 'Mindanao',
          coordinates: [7.8731, 125.2685]
        },
        story: 'Requesting support to establish a learning center for fishing communities. Need computers, internet connection, and educational materials.',
        studentsServed: 0,
        photos: [],
        contactEmail: 'mindanao.request@gmail.com',
        establishedDate: '2024-01-10',
        status: 'requesting',
        monthlyImpact: {
          newStudents: 0,
          lessonsCompleted: 0,
          certificatesEarned: 0
        }
      }
    ]

    const demoStats: DonationStats = {
      totalCenters: demoCenters.filter(c => c.status === 'active').length,
      totalStudents: demoCenters.reduce((sum, c) => sum + c.studentsServed, 0),
      totalDonors: 3,
      countriesReached: new Set(demoCenters.map(c => c.location.country)).size
    }

    setCenters(demoCenters)
    setStats(demoStats)
  }

  const handleRequestHelp = () => {
    setShowRequestForm(true)
  }

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
                ← Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Global Impact Map</h1>
              <p className="text-muted-foreground">See how education is changing lives around the world</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={handleRequestHelp}>
                Request Help for Your Community
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalCenters}</p>
                  <p className="text-sm text-muted-foreground">Active Centers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students Served</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Heart className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalDonors}</p>
                  <p className="text-sm text-muted-foreground">Generous Donors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.countriesReached}</p>
                  <p className="text-sm text-muted-foreground">Countries Reached</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Placeholder */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Education Centers Worldwide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 bg-muted flex items-center justify-center border">
              <div className="text-center">
                <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Interactive map coming soon</p>
                <p className="text-sm text-muted-foreground">Click on the centers below to explore their stories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Education Centers */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Education Centers</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {centers.map((center) => (
              <Card key={center.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedCenter(center)}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{center.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {center.location.city}, {center.location.country}
                      </p>
                    </div>
                    <Badge variant={
                      center.status === 'active' ? 'default' : 
                      center.status === 'requesting' ? 'secondary' : 'outline'
                    }>
                      {center.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-sm">{center.story.slice(0, 150)}...</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">{center.studentsServed}</p>
                      <p className="text-muted-foreground">Students Served</p>
                    </div>
                    <div>
                      <p className="font-medium">{center.monthlyImpact.lessonsCompleted}</p>
                      <p className="text-muted-foreground">Lessons/Month</p>
                    </div>
                  </div>
                  
                  {center.donorName && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Powered by:</p>
                      <p className="font-medium">{center.donorName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Center Detail Modal */}
        {selectedCenter && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{selectedCenter.name}</CardTitle>
                    <p className="text-muted-foreground">
                      {selectedCenter.location.city}, {selectedCenter.location.country}
                    </p>
                  </div>
                  <Badge variant={selectedCenter.status === 'active' ? 'default' : 'secondary'}>
                    {selectedCenter.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Our Story</h3>
                  <p className="text-sm">{selectedCenter.story}</p>
                </div>
                
                {selectedCenter.status === 'active' && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-2">Monthly Impact</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{selectedCenter.monthlyImpact.newStudents}</p>
                          <p className="text-muted-foreground">New Students</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-500">{selectedCenter.monthlyImpact.lessonsCompleted}</p>
                          <p className="text-muted-foreground">Lessons Completed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-500">{selectedCenter.monthlyImpact.certificatesEarned}</p>
                          <p className="text-muted-foreground">Certificates Earned</p>
                        </div>
                      </div>
                    </div>
                    
                    {selectedCenter.donorName && (
                      <div>
                        <h3 className="font-semibold mb-2">Made Possible By</h3>
                        <p className="text-primary font-medium">{selectedCenter.donorName}</p>
                        <p className="text-sm text-muted-foreground">Thank you for making education accessible!</p>
                      </div>
                    )}
                  </>
                )}
                
                <div>
                  <h3 className="font-semibold mb-2">Contact Information</h3>
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4" />
                    <span>{selectedCenter.contactEmail}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Established: {new Date(selectedCenter.establishedDate).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex space-x-4">
                  <Button variant="outline" onClick={() => setSelectedCenter(null)}>
                    Close
                  </Button>
                  {selectedCenter.status === 'requesting' && (
                    <Button>
                      Sponsor This Center
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Help Request Form */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Request Help for Your Community</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Community/Organization Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Your community center name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="City, Country"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tell us about your community and education needs
                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe your community, the students you serve, and what kind of support you need..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="your-email@example.com"
                  />
                </div>
                
                <div className="flex space-x-4">
                  <Button className="flex-1">Submit Request</Button>
                  <Button variant="outline" onClick={() => setShowRequestForm(false)}>
                    Cancel
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  We'll review your request and connect you with potential donors within 1-2 weeks.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}