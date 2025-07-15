'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/ui/user-menu'
import { Users, DollarSign, Heart, Globe, Check, X, Eye } from 'lucide-react'

interface HardshipRequest {
  id: string
  userEmail: string
  reason: string
  country: string
  status: 'pending' | 'approved' | 'denied'
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
}

interface HelpRequest {
  id: string
  organizationName: string
  location: string
  description: string
  contactEmail: string
  status: 'pending' | 'approved' | 'funded' | 'denied'
  submittedAt: string
  assignedDonor?: string
  estimatedCost?: number
}

interface AdminStats {
  totalUsers: number
  activeSubscriptions: number
  scholarshipStudents: number
  monthlyRevenue: number
  pendingRequests: number
  helpRequests: number
  activeCenters: number
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hardshipRequests, setHardshipRequests] = useState<HardshipRequest[]>([])
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([])
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    scholarshipStudents: 0,
    monthlyRevenue: 0,
    pendingRequests: 0,
    helpRequests: 0,
    activeCenters: 0
  })
  const [selectedRequest, setSelectedRequest] = useState<HardshipRequest | null>(null)
  const [selectedHelpRequest, setSelectedHelpRequest] = useState<HelpRequest | null>(null)
  const [adminLoading, setAdminLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'hardship' | 'help'>('hardship')

  useEffect(() => {
    if (loading) {
      return // Wait for auth to finish loading
    }

    // Wait for auth to load
    if (!user) {
      router.push('/')
      return
    }

    // Check if user is admin (in a real app, this would be server-side)
    if (user.email !== 'admin@eduroot.com') {
      router.push('/dashboard')
      return
    }

    loadAdminData()
    setAdminLoading(false)
  }, [user, loading, router])

  const loadAdminData = () => {
    // Demo data - in real app, this would come from API
    const demoRequests: HardshipRequest[] = [
      {
        id: '1',
        userEmail: 'student1@example.com',
        reason: 'I am a single mother of three children trying to complete my GED. I lost my job during the pandemic and cannot afford the subscription fee. Education is my path to a better future for my family.',
        country: 'United States',
        status: 'pending',
        submittedAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        userEmail: 'learner@gmail.com',
        reason: 'I live in rural Kenya and work as a farmer. My income is very low and irregular. I want to improve my English and math skills to help my community with better farming techniques.',
        country: 'Kenya',
        status: 'pending',
        submittedAt: '2024-01-14T15:45:00Z'
      },
      {
        id: '3',
        userEmail: 'refugee@email.com',
        reason: 'I am a refugee from Syria now living in Jordan. I have no income and am trying to learn English to find work and support my family.',
        country: 'Jordan',
        status: 'approved',
        submittedAt: '2024-01-10T08:20:00Z',
        reviewedAt: '2024-01-12T14:30:00Z',
        reviewedBy: 'admin@eduroot.com'
      }
    ]

    const demoHelpRequests: HelpRequest[] = [
      {
        id: '1',
        organizationName: 'Rural Philippines Community Center',
        location: 'Mindanao, Philippines',
        description: 'We serve a fishing community of 200 families. Need computers, internet connection, and educational materials to help children and adults learn basic literacy and numeracy.',
        contactEmail: 'mindanao.request@gmail.com',
        status: 'pending',
        submittedAt: '2024-01-10T08:00:00Z',
        estimatedCost: 5000
      },
      {
        id: '2',
        organizationName: 'Bolivian Mountain School',
        location: 'La Paz, Bolivia',
        description: 'High-altitude indigenous community needs educational support. Many students walk 2 hours to reach us. We need tablets and solar power for sustainable learning.',
        contactEmail: 'bolivia.education@gmail.com',
        status: 'approved',
        submittedAt: '2024-01-05T12:00:00Z',
        assignedDonor: 'Mountain Education Fund',
        estimatedCost: 3500
      }
    ]

    const demoStats: AdminStats = {
      totalUsers: 1247,
      activeSubscriptions: 342,
      scholarshipStudents: 89,
      monthlyRevenue: 2150,
      pendingRequests: demoRequests.filter(r => r.status === 'pending').length,
      helpRequests: demoHelpRequests.filter(r => r.status === 'pending').length,
      activeCenters: 3
    }

    setHardshipRequests(demoRequests)
    setHelpRequests(demoHelpRequests)
    setStats(demoStats)
  }

  const handleRequestReview = (requestId: string, action: 'approve' | 'deny') => {
    setHardshipRequests(prev => 
      prev.map(request => 
        request.id === requestId 
          ? {
              ...request,
              status: action === 'approve' ? 'approved' : 'denied',
              reviewedAt: new Date().toISOString(),
              reviewedBy: user?.email || 'admin'
            }
          : request
      )
    )
    
    // Update stats
    if (action === 'approve') {
      setStats(prev => ({
        ...prev,
        scholarshipStudents: prev.scholarshipStudents + 1,
        pendingRequests: prev.pendingRequests - 1
      }))
    } else {
      setStats(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests - 1
      }))
    }
    
    setSelectedRequest(null)
  }

  const handleHelpRequestReview = (requestId: string, action: 'approve' | 'deny', donorName?: string) => {
    setHelpRequests(prev => 
      prev.map(request => 
        request.id === requestId 
          ? {
              ...request,
              status: action === 'approve' ? 'approved' : 'denied',
              assignedDonor: donorName || undefined
            }
          : request
      )
    )
    
    if (action === 'approve') {
      setStats(prev => ({
        ...prev,
        activeCenters: prev.activeCenters + 1,
        helpRequests: prev.helpRequests - 1
      }))
    } else {
      setStats(prev => ({
        ...prev,
        helpRequests: prev.helpRequests - 1
      }))
    }
    
    setSelectedHelpRequest(null)
  }

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading admin panel...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user || user.email !== 'admin@eduroot.com') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage users, subscriptions, and hardship requests</p>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
                  <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Heart className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.scholarshipStudents}</p>
                  <p className="text-sm text-muted-foreground">Scholarship Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">${stats.monthlyRevenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeCenters}</p>
                  <p className="text-sm text-muted-foreground">Active Centers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request Management Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex space-x-4">
                <Button 
                  variant={activeTab === 'hardship' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('hardship')}
                >
                  Hardship Requests ({stats.pendingRequests})
                </Button>
                <Button 
                  variant={activeTab === 'help' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('help')}
                >
                  Help Requests ({stats.helpRequests})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'hardship' && (
              <div className="space-y-4">
                {hardshipRequests.map((request) => (
                <div key={request.id} className="border border-border p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{request.userEmail}</p>
                      <p className="text-sm text-muted-foreground">{request.country}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' : 
                          request.status === 'denied' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm">{request.reason.slice(0, 150)}...</p>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Full
                    </Button>
                    
                    {request.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleRequestReview(request.id, 'approve')}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRequestReview(request.id, 'deny')}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              </div>
            )}

            {activeTab === 'help' && (
              <div className="space-y-4">
                {helpRequests.map((request) => (
                  <div key={request.id} className="border border-border p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{request.organizationName}</p>
                        <p className="text-sm text-muted-foreground">{request.location}</p>
                        <p className="text-sm text-muted-foreground">
                          Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={
                            request.status === 'approved' ? 'default' : 
                            request.status === 'funded' ? 'secondary' :
                            request.status === 'denied' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {request.status}
                        </Badge>
                        {request.estimatedCost && (
                          <Badge variant="outline">
                            ${request.estimatedCost.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm">{request.description.slice(0, 150)}...</p>
                    
                    {request.assignedDonor && (
                      <p className="text-sm text-muted-foreground">
                        Assigned to: <span className="font-medium">{request.assignedDonor}</span>
                      </p>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedHelpRequest(request)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Full
                      </Button>
                      
                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleHelpRequestReview(request.id, 'approve', 'Community Sponsor')}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve & Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleHelpRequestReview(request.id, 'deny')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Deny
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Hardship Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">User: {selectedRequest.userEmail}</p>
                  <p className="text-sm text-muted-foreground">Country: {selectedRequest.country}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted: {new Date(selectedRequest.submittedAt).toLocaleString()}
                  </p>
                  <Badge className="mt-2">{selectedRequest.status}</Badge>
                </div>
                
                <div>
                  <p className="font-medium mb-2">Reason for Request:</p>
                  <p className="text-sm bg-muted p-3">{selectedRequest.reason}</p>
                </div>
                
                {selectedRequest.reviewedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Reviewed on {new Date(selectedRequest.reviewedAt).toLocaleString()} by {selectedRequest.reviewedBy}
                    </p>
                  </div>
                )}
                
                <div className="flex space-x-4">
                  {selectedRequest.status === 'pending' && (
                    <>
                      <Button onClick={() => handleRequestReview(selectedRequest.id, 'approve')}>
                        <Check className="w-4 h-4 mr-1" />
                        Approve Request
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleRequestReview(selectedRequest.id, 'deny')}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Deny Request
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Help Request Detail Modal */}
        {selectedHelpRequest && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Community Help Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">Organization: {selectedHelpRequest.organizationName}</p>
                  <p className="text-sm text-muted-foreground">Location: {selectedHelpRequest.location}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted: {new Date(selectedHelpRequest.submittedAt).toLocaleString()}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge>{selectedHelpRequest.status}</Badge>
                    {selectedHelpRequest.estimatedCost && (
                      <Badge variant="outline">
                        Estimated Cost: ${selectedHelpRequest.estimatedCost.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="font-medium mb-2">Community Description & Needs:</p>
                  <p className="text-sm bg-muted p-3">{selectedHelpRequest.description}</p>
                </div>
                
                <div>
                  <p className="font-medium mb-2">Contact Information:</p>
                  <p className="text-sm">{selectedHelpRequest.contactEmail}</p>
                </div>
                
                {selectedHelpRequest.assignedDonor && (
                  <div>
                    <p className="font-medium mb-2">Assigned Donor/Sponsor:</p>
                    <p className="text-sm text-primary font-medium">{selectedHelpRequest.assignedDonor}</p>
                  </div>
                )}
                
                <div className="flex space-x-4">
                  {selectedHelpRequest.status === 'pending' && (
                    <>
                      <Button onClick={() => {
                        const donorName = prompt('Enter donor/sponsor name:') || 'Anonymous Donor'
                        handleHelpRequestReview(selectedHelpRequest.id, 'approve', donorName)
                      }}>
                        <Check className="w-4 h-4 mr-1" />
                        Approve & Assign Donor
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleHelpRequestReview(selectedHelpRequest.id, 'deny')}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Deny Request
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setSelectedHelpRequest(null)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}