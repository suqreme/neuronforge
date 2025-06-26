import { NextRequest, NextResponse } from 'next/server'
import { getContext, updateContext, logChange } from '@/lib/sharedContext'
import OpenAI from 'openai'
import { managerAgent } from '@/agents/managerAgent'
import { frontendAgent } from '@/agents/frontendAgent'
import { backendAgent } from '@/agents/backendAgent'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  const context = getContext()

  const systemPrompt = `You are the manager AI. Here is the current context:
Prompt: ${context.prompt}
Analysis: ${context.analysis}
Stack: ${JSON.stringify(context.stack)}
Tasks: ${JSON.stringify(context.tasks)}
Changelog: ${context.changelog.join('\n')}`

  const chat = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    model: 'gpt-4o',
    temperature: 0.7,
  })

  const reply = chat.choices[0].message.content || 'No response.'
  logChange(`manager agent: ${message}`)

  // 🧠 Let manager reinterpret entire prompt and regenerate instructions
  const { analysis, stack, tasks } = await managerAgent(context.prompt)

  // 🤖 Trigger agents to rebuild based on new stack/tasks
  const [frontendCode, backendCode] = await Promise.all([
    frontendAgent(),
    backendAgent(),
  ])

  updateContext({
    analysis,
    stack,
    tasks,
    code: {
      frontend: frontendCode,
      backend: backendCode,
    },
  })

  return NextResponse.json({ reply, stack, tasks })
}
