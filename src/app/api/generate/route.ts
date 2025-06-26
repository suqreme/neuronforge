import { NextResponse } from 'next/server'
import { managerAgent } from '@/agents/managerAgent'
import { frontendAgent } from '@/agents/frontendAgent'
import { backendAgent } from '@/agents/backendAgent'
import { saveToFile } from '@/utils/saveFile'
import { updateContext } from '@/lib/sharedContext'

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    // Step 1: Let the manager plan everything
    const { analysis, stack, tasks } = await managerAgent(prompt)

    const projectMeta = {
      prompt,
      analysis,
      stack,
      tasks,
      createdAt: new Date().toISOString(),
    }

    // Save metadata to file (optional)
    saveToFile('project.json', JSON.stringify(projectMeta, null, 2))

    // Step 2: Generate code from both agents
    const [frontendCode, backendCode] = await Promise.all([
      frontendAgent(tasks.frontend, stack.frontend),
      backendAgent(tasks.backend, stack.backend),
    ])

    // Step 3: Store everything in shared memory
    updateContext({
      prompt,
      analysis,
      stack,
      tasks,
      code: {
        frontend: frontendCode,
        backend: backendCode,
      },
      changelog: ['Initialized project and generated code'],
    })

    return NextResponse.json({
      analysis,
      stack,
      tasks,
      frontend: frontendCode,
      backend: backendCode,
    })
  } catch (err: any) {
    console.error('❌ API ERROR:', err)
    return NextResponse.json(
      { error: 'Internal Server Error', message: err?.message || err },
      { status: 500 }
    )
  }
}
