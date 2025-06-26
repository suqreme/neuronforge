// --- src/app/api/chat/[agent]/route.ts ---

import { NextRequest, NextResponse } from 'next/server'
import { getContext, updateCode, logChange, setContext } from '@/lib/sharedContext'
import { frontendAgent } from '@/agents/frontendAgent'
import { backendAgent } from '@/agents/backendAgent'
import { managerAgent } from '@/agents/managerAgent'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(
  req: NextRequest,
  { params }: { params: { agent: 'frontend' | 'backend' | 'manager' } }
) {
  const { message } = await req.json()
  const context = getContext()
  const agent = params.agent

  let systemPrompt = ''
  if (agent === 'manager') {
    systemPrompt = `You are the manager AI. Here is the project context:
Prompt: ${context.prompt}
Analysis: ${context.analysis}
Stack: ${JSON.stringify(context.stack)}
Changelog: ${context.changelog.join('\n')}`
  } else {
    const role = agent === 'frontend' ? 'frontend UI developer' : 'backend API developer'
    systemPrompt = `You are the ${role}. You are part of a team of AI agents working on the project.
Stack: ${context.stack[agent]}
Your original task: ${context.tasks[agent]}
Your current code: ${context.code[agent]}
Recent changes: ${context.changelog.join('\n')}`
  }

  const chat = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    model: 'gpt-4o',
    temperature: 0.7,
  })

  const reply = chat.choices[0].message.content || 'No response.'
  logChange(`${agent} agent: ${message}`)

  let updatedCode = null

  if (agent === 'frontend') {
    updatedCode = await frontendAgent()
    updateCode('frontend', updatedCode)
  }

  if (agent === 'backend') {
    updatedCode = await backendAgent()
    updateCode('backend', updatedCode)
  }

  if (agent === 'manager') {
    const result = await managerAgent(context.prompt)
    const { analysis, stack, tasks } = result

    const newFrontend = await frontendAgent()
    const newBackend = await backendAgent()

    setContext({
      analysis,
      stack,
      tasks,
      code: { frontend: newFrontend, backend: newBackend },
    })
    updatedCode = '[Manager updated both agents.]'
  }

  return NextResponse.json({ reply, code: updatedCode })
}
