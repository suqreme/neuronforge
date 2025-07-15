'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Check, Heart, Users, Globe } from 'lucide-react'

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  interval: string
  description: string
  features: string[]
  popular?: boolean
}

const plans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Access',
    price: 0,
    interval: 'forever',
    description: 'Basic learning with limited features',
    features: [
      '3 lessons per day',
      'Basic progress tracking',
      'Community support',
      'Mobile access'
    ]
  },
  {
    id: 'supporter',
    name: 'Supporter',
    price: 5,
    interval: 'month',
    description: 'Support global education while learning',
    features: [
      'Unlimited lessons',
      'Advanced progress analytics',
      'Priority support',
      'Offline lesson downloads',
      'Certificate generation',
      'Help fund scholarships'
    ],
    popular: true
  },
  {
    id: 'sponsor',
    name: 'Education Sponsor',
    price: 25,
    interval: 'month',
    description: 'Sponsor education for underserved communities',
    features: [
      'Everything in Supporter',
      'Sponsor 5 scholarship students',
      'Impact reports and updates',
      'Donor recognition (optional)',
      'Priority feature requests',
      'Monthly community calls'
    ]
  }
]

export default function SubscriptionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showHardshipForm, setShowHardshipForm] = useState(false)

  const handleSubscribe = async (planId: string) => {
    setLoading(planId)
    
    try {
      // In a real implementation, this would integrate with Stripe
      console.log(`Subscribing to plan: ${planId}`)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // For demo, just show success message
      alert(`Successfully subscribed to ${plans.find(p => p.id === planId)?.name}!`)
      
    } catch (error) {
      console.error('Subscription error:', error)
      alert('Subscription failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleHardshipRequest = () => {
    setShowHardshipForm(true)
  }

  if (!user) {
    router.push('/')
    return null
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
              <h1 className="text-2xl font-bold text-foreground">Choose Your Plan</h1>
              <p className="text-muted-foreground">Support global education while advancing your own learning</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Impact Statement */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center space-x-8 text-sm">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span>1,247 students supported</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <span>23 countries reached</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-primary" />
                  <span>$12,450 donated to scholarships</span>
                </div>
              </div>
              <p className="text-muted-foreground">
                Every subscription helps provide free education to students who need it most
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  ${plan.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.interval}
                  </span>
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? 'Processing...' : 
                   plan.price === 0 ? 'Current Plan' : 'Subscribe Now'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hardship Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="w-5 h-5" />
              <span>Need Financial Assistance?</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We believe education should be accessible to everyone, regardless of financial circumstances. 
              If you're unable to afford a subscription, you can apply for free access through our hardship program.
            </p>
            
            <div className="flex space-x-4">
              <Button variant="outline" onClick={handleHardshipRequest}>
                Apply for Free Access
              </Button>
              <Button variant="ghost" onClick={() => router.push('/campaign')}>
                See Our Global Impact
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hardship Form Modal */}
        {showHardshipForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Hardship Access Application</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tell us about your situation
                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Please describe your financial circumstances and why you need free access to education..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Country/Region
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Your location"
                  />
                </div>
                
                <div className="flex space-x-4">
                  <Button className="flex-1">Submit Application</Button>
                  <Button variant="outline" onClick={() => setShowHardshipForm(false)}>
                    Cancel
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Applications are reviewed within 2-3 business days. We'll email you with the decision.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}