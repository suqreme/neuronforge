// --- src/agents/managerAgent.ts ---
import OpenAI from 'openai'
import { getContext, updateContext, logChange } from '@/lib/sharedContext'
import { frontendAgent } from './frontendAgent'
import { backendAgent } from './backendAgent'
import { saveToFile } from '@/utils/saveFile'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function managerAgent(message: string) {
  const context = getContext()

  const systemPrompt = `You are a senior AI software architect and project manager.
Your job is to analyze the project goal, choose a modern stack, and assign clear tasks to frontend and backend developers.

Use this format only:
{
  "analysis": "Brief explanation",
  "stack": {
    "frontend": "React + Tailwind",
    "backend": "Express + PostgreSQL"
  },
  "tasks": {
    "frontend": "Build a UI that...",
    "backend": "Implement an API that..."
  }
}

Previous Prompt: ${context.prompt}
Previous Stack: ${JSON.stringify(context.stack)}
Previous Tasks: ${JSON.stringify(context.tasks)}
Change Log: ${context.changelog.join('\n')}

Only return the raw JSON. No markdown or comments.`

  const chat = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
  })

  const content = chat.choices?.[0]?.message?.content || '{}'

  const clean = content
    .replace(/^```json/, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(clean)

    // Save and update shared memory
    updateContext({
      prompt: message,
      analysis: parsed.analysis,
      stack: parsed.stack,
      tasks: parsed.tasks,
    })

    logChange(`manager: ${message}`)

    // Auto-regenerate frontend and backend code
    const [frontendCode, backendCode] = await Promise.all([
      frontendAgent(),
      backendAgent(),
    ])

    // Save outputs
    saveToFile('frontend.ts', frontendCode)
    saveToFile('backend.ts', backendCode)

    return {
      analysis: parsed.analysis,
      stack: parsed.stack,
      tasks: parsed.tasks,
      frontend: frontendCode,
      backend: backendCode,
    }
  } catch (err) {
    console.error('❌ Failed to parse manager response:', clean)
    throw new Error(`ManagerAgent JSON parse failed: ${err}`)
  }
}
