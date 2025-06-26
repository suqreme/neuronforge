// --- /src/app/api/context/route.ts ---
import { NextResponse } from 'next/server'
import { getContext } from '@/lib/sharedContext'

export async function GET() {
  const context = getContext()
  return NextResponse.json(context)
}
