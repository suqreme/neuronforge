import { NextResponse } from 'next/server'
import { frontendAgent } from '@/agents/frontendAgent'
import { backendAgent } from '@/agents/backendAgent'
import { saveToFile } from '@/utils/saveFile'

export async function POST(req: Request) {
  try {
    const { agent, task, stack } = await req.json()

    if (!['frontend', 'backend'].includes(agent)) {
      return NextResponse.json({ error: 'Invalid agent' }, { status: 400 })
    }

    const output =
      agent === 'frontend'
        ? await frontendAgent(task, stack)
        : await backendAgent(task, stack)

    const filename = `${agent}.ts`
    saveToFile(filename, output)

    return NextResponse.json({ success: true, output })
  } catch (err: any) {
    console.error('❌ Retry API Error:', err)
    return NextResponse.json(
      { error: 'Retry failed', message: err?.message },
      { status: 500 }
    )
  }
}
