// This file is now only used in server-side API routes
// Client-side components should use the API routes instead

import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder-key',
})

// Note: These functions are now only used in API routes
// Client components should call the corresponding API endpoints