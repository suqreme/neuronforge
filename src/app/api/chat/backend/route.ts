// --- src/app/api/chat/backend/route.ts ---
import { NextRequest, NextResponse } from 'next/server'
import { getContext, updateContext, logChange } from '@/lib/sharedContext'
import OpenAI from 'openai'
import { backendAgent } from '@/agents/backendAgent'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  const context = getContext()

  const systemPrompt = `You are the backend API developer.
Stack: ${context.stack.backend}
Your original task: ${context.tasks.backend}
Your current code: ${context.code.backend}
Recent changes: ${context.changelog.join('\n')}`

  const chat = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    model: 'gpt-4o',
    temperature: 0.7,
  })

  const reply = chat.choices[0].message.content || 'No response.'
  logChange(`backend agent: ${message}`)

  // ✅ Let agent regenerate backend code based on updated context
  const newCode = await backendAgent()
  updateContext({ code: { ...context.code, backend: newCode } })

  return NextResponse.json({ reply, newCode })
}
