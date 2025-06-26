import { NextRequest, NextResponse } from 'next/server'
import { frontendAgent } from '@/agents/frontendAgent'
import { backendAgent } from '@/agents/backendAgent'
import { saveToFile } from '@/utils/saveFile'
import { updateCode, logChange } from '@/lib/sharedContext'

export async function POST(req: NextRequest) {
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

    updateCode(agent, output)
    logChange(`${agent} agent retried and updated code.`)

    return NextResponse.json({ success: true, output })
  } catch (err: any) {
    console.error('❌ Retry API Error:', err)
    return NextResponse.json(
      { error: 'Retry failed', message: err?.message },
      { status: 500 }
    )
  }
}
