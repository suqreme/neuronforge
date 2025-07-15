'use client'

import { useEffect } from 'react'
import { themeService } from '@/services/themeService'

export function ThemeInitializer() {
  useEffect(() => {
    // Initialize theme on client side
    const initTheme = () => {
      themeService.initializeTheme()
    }

    // Run immediately
    initTheme()

    // Also run after a short delay to ensure DOM is ready
    const timeout = setTimeout(initTheme, 100)

    return () => clearTimeout(timeout)
  }, [])

  return null
}