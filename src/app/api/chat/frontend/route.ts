import { NextRequest, NextResponse } from 'next/server'
import { getContext, updateContext, logChange } from '@/lib/sharedContext'
import OpenAI from 'openai'
import { frontendAgent } from '@/agents/frontendAgent'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  const context = getContext()

  const systemPrompt = `You are the frontend UI developer.
Stack: ${context.stack.frontend}
Your original task: ${context.tasks.frontend}
Your current code: ${context.code.frontend}
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
  logChange(`frontend agent: ${message}`)

  // ✅ Trigger regeneration
  const newCode = await frontendAgent()
  updateContext({ code: { ...context.code, frontend: newCode } })

  return NextResponse.json({ reply, newCode })
}
