interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  requirement: {
    type: 'lessons_completed' | 'quizzes_passed' | 'streak_days' | 'xp_earned' | 'perfect_scores' | 'subjects_completed'
    value: number
  }
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface UserBadge {
  badgeId: string
  earnedAt: string
  progress?: number
}

interface XPEvent {
  type: 'lesson_completed' | 'quiz_passed' | 'perfect_quiz' | 'streak_bonus' | 'first_lesson' | 'review_completed'
  xpGained: number
  timestamp: string
  details?: string
}

interface Achievement {
  id: string
  title: string
  message: string
  badgeId?: string
  xpGained: number
  timestamp: string
}

interface UserLevel {
  level: number
  currentXP: number
  xpToNextLevel: number
  totalXP: number
}

class GamificationService {
  private storageKey = 'user_gamification'

  // Define all available badges
  private badges: Badge[] = [
    {
      id: 'first_lesson',
      name: 'First Steps',
      description: 'Complete your first lesson',
      icon: '🎯',
      color: 'bg-blue-500',
      requirement: { type: 'lessons_completed', value: 1 },
      rarity: 'common'
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Complete 5 lessons',
      icon: '🌅',
      color: 'bg-green-500',
      requirement: { type: 'lessons_completed', value: 5 },
      rarity: 'common'
    },
    {
      id: 'scholar',
      name: 'Scholar',
      description: 'Complete 25 lessons',
      icon: '📚',
      color: 'bg-purple-500',
      requirement: { type: 'lessons_completed', value: 25 },
      rarity: 'rare'
    },
    {
      id: 'master_learner',
      name: 'Master Learner',
      description: 'Complete 100 lessons',
      icon: '🎓',
      color: 'bg-gold-500',
      requirement: { type: 'lessons_completed', value: 100 },
      rarity: 'epic'
    },
    {
      id: 'quiz_master',
      name: 'Quiz Master',
      description: 'Pass 10 quizzes',
      icon: '🧠',
      color: 'bg-indigo-500',
      requirement: { type: 'quizzes_passed', value: 10 },
      rarity: 'rare'
    },
    {
      id: 'perfectionist',
      name: 'Perfectionist',
      description: 'Get 5 perfect quiz scores',
      icon: '💯',
      color: 'bg-yellow-500',
      requirement: { type: 'perfect_scores', value: 5 },
      rarity: 'epic'
    },
    {
      id: 'streak_starter',
      name: 'Streak Starter',
      description: 'Maintain a 3-day learning streak',
      icon: '🔥',
      color: 'bg-orange-500',
      requirement: { type: 'streak_days', value: 3 },
      rarity: 'common'
    },
    {
      id: 'dedicated',
      name: 'Dedicated Learner',
      description: 'Maintain a 7-day learning streak',
      icon: '⚡',
      color: 'bg-red-500',
      requirement: { type: 'streak_days', value: 7 },
      rarity: 'rare'
    },
    {
      id: 'unstoppable',
      name: 'Unstoppable',
      description: 'Maintain a 30-day learning streak',
      icon: '🌟',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      requirement: { type: 'streak_days', value: 30 },
      rarity: 'legendary'
    },
    {
      id: 'xp_collector',
      name: 'XP Collector',
      description: 'Earn 1000 XP',
      icon: '💎',
      color: 'bg-cyan-500',
      requirement: { type: 'xp_earned', value: 1000 },
      rarity: 'rare'
    }
  ]

  getUserGamification(userId: string) {
    try {
      const stored = localStorage.getItem(`${this.storageKey}_${userId}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error loading gamification data:', error)
    }

    // Default gamification data
    return {
      level: 1,
      totalXP: 0,
      earnedBadges: [],
      xpHistory: [],
      achievements: [],
      stats: {
        lessonsCompleted: 0,
        quizzesPassed: 0,
        perfectScores: 0,
        currentStreak: 0,
        longestStreak: 0
      }
    }
  }

  saveUserGamification(userId: string, data: any): void {
    try {
      localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving gamification data:', error)
    }
  }

  calculateLevel(totalXP: number): UserLevel {
    // XP required for each level: 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500...
    // Formula: level * 100 + (level - 1) * 100 = level * 200 - 100
    let level = 1
    let xpRequired = 100
    let totalRequired = 0

    while (totalXP >= totalRequired + xpRequired) {
      totalRequired += xpRequired
      level++
      xpRequired = level * 200 - 100
    }

    return {
      level,
      currentXP: totalXP - totalRequired,
      xpToNextLevel: xpRequired - (totalXP - totalRequired),
      totalXP
    }
  }

  awardXP(userId: string, event: Omit<XPEvent, 'timestamp'>): { newAchievements: Achievement[], levelUp: boolean } {
    const data = this.getUserGamification(userId)
    const oldLevel = this.calculateLevel(data.totalXP).level
    
    // Add XP
    data.totalXP += event.xpGained
    
    // Record XP event
    const xpEvent: XPEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }
    data.xpHistory.push(xpEvent)
    
    // Check for level up
    const newLevel = this.calculateLevel(data.totalXP).level
    const levelUp = newLevel > oldLevel
    
    const newAchievements: Achievement[] = []
    
    // Check for new badges
    const newBadges = this.checkForNewBadges(userId, data)
    newBadges.forEach(badge => {
      const achievement: Achievement = {
        id: `badge_${badge.id}_${Date.now()}`,
        title: `Badge Earned: ${badge.name}`,
        message: badge.description,
        badgeId: badge.id,
        xpGained: this.getBadgeXPReward(badge.rarity),
        timestamp: new Date().toISOString()
      }
      
      data.achievements.push(achievement)
      data.totalXP += achievement.xpGained
      newAchievements.push(achievement)
    })
    
    // Add level up achievement
    if (levelUp) {
      const levelAchievement: Achievement = {
        id: `level_${newLevel}_${Date.now()}`,
        title: `Level Up!`,
        message: `You've reached level ${newLevel}!`,
        xpGained: 0,
        timestamp: new Date().toISOString()
      }
      
      data.achievements.push(levelAchievement)
      newAchievements.push(levelAchievement)
    }
    
    this.saveUserGamification(userId, data)
    
    return { newAchievements, levelUp }
  }

  private checkForNewBadges(userId: string, data: any): Badge[] {
    const earnedBadgeIds = data.earnedBadges.map((ub: UserBadge) => ub.badgeId)
    const newBadges: Badge[] = []
    
    for (const badge of this.badges) {
      if (earnedBadgeIds.includes(badge.id)) continue
      
      let earned = false
      switch (badge.requirement.type) {
        case 'lessons_completed':
          earned = data.stats.lessonsCompleted >= badge.requirement.value
          break
        case 'quizzes_passed':
          earned = data.stats.quizzesPassed >= badge.requirement.value
          break
        case 'perfect_scores':
          earned = data.stats.perfectScores >= badge.requirement.value
          break
        case 'streak_days':
          earned = data.stats.currentStreak >= badge.requirement.value
          break
        case 'xp_earned':
          earned = data.totalXP >= badge.requirement.value
          break
      }
      
      if (earned) {
        const userBadge: UserBadge = {
          badgeId: badge.id,
          earnedAt: new Date().toISOString()
        }
        data.earnedBadges.push(userBadge)
        newBadges.push(badge)
      }
    }
    
    return newBadges
  }

  private getBadgeXPReward(rarity: string): number {
    switch (rarity) {
      case 'common': return 50
      case 'rare': return 100
      case 'epic': return 200
      case 'legendary': return 500
      default: return 25
    }
  }

  updateStats(userId: string, stats: Partial<any>): void {
    const data = this.getUserGamification(userId)
    data.stats = { ...data.stats, ...stats }
    this.saveUserGamification(userId, data)
  }

  getBadgeById(badgeId: string): Badge | undefined {
    return this.badges.find(b => b.id === badgeId)
  }

  getAllBadges(): Badge[] {
    return [...this.badges]
  }

  getUserBadgeProgress(userId: string): Array<{badge: Badge, earned: boolean, progress: number}> {
    const data = this.getUserGamification(userId)
    const earnedBadgeIds = data.earnedBadges.map((ub: UserBadge) => ub.badgeId)
    
    return this.badges.map(badge => {
      const earned = earnedBadgeIds.includes(badge.id)
      let progress = 0
      
      if (!earned) {
        switch (badge.requirement.type) {
          case 'lessons_completed':
            progress = Math.min(100, (data.stats.lessonsCompleted / badge.requirement.value) * 100)
            break
          case 'quizzes_passed':
            progress = Math.min(100, (data.stats.quizzesPassed / badge.requirement.value) * 100)
            break
          case 'perfect_scores':
            progress = Math.min(100, (data.stats.perfectScores / badge.requirement.value) * 100)
            break
          case 'streak_days':
            progress = Math.min(100, (data.stats.currentStreak / badge.requirement.value) * 100)
            break
          case 'xp_earned':
            progress = Math.min(100, (data.totalXP / badge.requirement.value) * 100)
            break
        }
      } else {
        progress = 100
      }
      
      return { badge, earned, progress }
    })
  }

  getRecentAchievements(userId: string, limit: number = 5): Achievement[] {
    const data = this.getUserGamification(userId)
    return data.achievements
      .sort((a: Achievement, b: Achievement) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }
}

export const gamificationService = new GamificationService()