
import OpenAI from 'openai'
import { getContext } from '@/lib/sharedContext'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function frontendAgent() {
  const context = getContext()
  const task = context.tasks.frontend
  const stack = context.stack.frontend

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a senior frontend engineer. Your task is to generate code based on the given instructions and tech stack.

Respond ONLY with the full source code of the main file. No explanations, no markdown, no comments.

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