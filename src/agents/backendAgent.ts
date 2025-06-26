// --- src/agents/backendAgent.ts ---

import OpenAI from 'openai'
import { getContext } from '@/lib/sharedContext'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function backendAgent() {
  const context = getContext()
  const task = context.tasks.backend
  const stack = context.stack.backend

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a senior backend engineer. Your task is to generate backend code based on the following task and stack.

Respond ONLY with the full code. No explanations, no markdown, no comments.

Tech Stack: ${stack}`,
      },
      {
        role: 'user',
        content: task,
      },
    ],
  })

  const content = res.choices?.[0]?.message?.content || ''

  return content
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/, '')
    .trim()
}
