interface SubscriptionStatus {
  plan: 'free' | 'supporter' | 'sponsor' | 'hardship'
  status: 'active' | 'inactive' | 'pending' | 'cancelled'
  expiresAt?: string
  features: {
    dailyLessonLimit: number | null // null = unlimited
    analyticsAccess: boolean
    prioritySupport: boolean
    offlineDownloads: boolean
    certificateGeneration: boolean
    scholarshipFunding: boolean
  }
}

class SubscriptionService {
  private storageKey = 'user_subscription'

  getUserSubscription(userId: string): SubscriptionStatus {
    try {
      const stored = localStorage.getItem(`${this.storageKey}_${userId}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
    }

    // Default free plan
    return {
      plan: 'free',
      status: 'active',
      features: {
        dailyLessonLimit: 3,
        analyticsAccess: false,
        prioritySupport: false,
        offlineDownloads: false,
        certificateGeneration: false,
        scholarshipFunding: false
      }
    }
  }

  updateSubscription(userId: string, subscription: SubscriptionStatus): void {
    try {
      localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(subscription))
    } catch (error) {
      console.error('Error saving subscription:', error)
    }
  }

  subscribeToPlan(userId: string, planId: string): SubscriptionStatus {
    const planFeatures = this.getPlanFeatures(planId)
    const subscription: SubscriptionStatus = {
      plan: planId as any,
      status: 'active',
      expiresAt: planId !== 'free' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      features: planFeatures
    }

    this.updateSubscription(userId, subscription)
    return subscription
  }

  grantHardshipAccess(userId: string): SubscriptionStatus {
    const subscription: SubscriptionStatus = {
      plan: 'hardship',
      status: 'active',
      features: {
        dailyLessonLimit: null, // unlimited
        analyticsAccess: true,
        prioritySupport: true,
        offlineDownloads: true,
        certificateGeneration: true,
        scholarshipFunding: false
      }
    }

    this.updateSubscription(userId, subscription)
    return subscription
  }

  checkLessonAccess(userId: string): { allowed: boolean; reason?: string } {
    const subscription = this.getUserSubscription(userId)
    
    if (subscription.status !== 'active') {
      return { allowed: false, reason: 'Subscription not active' }
    }

    if (subscription.features.dailyLessonLimit === null) {
      return { allowed: true } // unlimited
    }

    // Check daily lesson count
    const today = new Date().toDateString()
    const dailyKey = `daily_lessons_${userId}_${today}`
    const todayCount = parseInt(localStorage.getItem(dailyKey) || '0')

    if (todayCount >= subscription.features.dailyLessonLimit) {
      return { 
        allowed: false, 
        reason: `Daily limit of ${subscription.features.dailyLessonLimit} lessons reached. Upgrade for unlimited access.`
      }
    }

    return { allowed: true }
  }

  recordLessonAccess(userId: string): void {
    const today = new Date().toDateString()
    const dailyKey = `daily_lessons_${userId}_${today}`
    const todayCount = parseInt(localStorage.getItem(dailyKey) || '0')
    localStorage.setItem(dailyKey, (todayCount + 1).toString())
  }

  private getPlanFeatures(planId: string) {
    switch (planId) {
      case 'supporter':
        return {
          dailyLessonLimit: null,
          analyticsAccess: true,
          prioritySupport: true,
          offlineDownloads: true,
          certificateGeneration: true,
          scholarshipFunding: true
        }
      case 'sponsor':
        return {
          dailyLessonLimit: null,
          analyticsAccess: true,
          prioritySupport: true,
          offlineDownloads: true,
          certificateGeneration: true,
          scholarshipFunding: true
        }
      case 'free':
      default:
        return {
          dailyLessonLimit: 3,
          analyticsAccess: false,
          prioritySupport: false,
          offlineDownloads: false,
          certificateGeneration: false,
          scholarshipFunding: false
        }
    }
  }

  getLessonUsageToday(userId: string): number {
    const today = new Date().toDateString()
    const dailyKey = `daily_lessons_${userId}_${today}`
    return parseInt(localStorage.getItem(dailyKey) || '0')
  }

  getRemainingLessons(userId: string): number | null {
    const subscription = this.getUserSubscription(userId)
    
    if (subscription.features.dailyLessonLimit === null) {
      return null // unlimited
    }

    const used = this.getLessonUsageToday(userId)
    return Math.max(0, subscription.features.dailyLessonLimit - used)
  }
}

export const subscriptionService = new SubscriptionService()