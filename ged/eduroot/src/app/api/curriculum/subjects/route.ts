import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    const curriculumPath = path.join(process.cwd(), 'curriculum')
    const files = await fs.readdir(curriculumPath)
    const subjects = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
    
    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('Error reading curriculum directory:', error)
    return NextResponse.json(
      { error: 'Failed to read curriculum directory' },
      { status: 500 }
    )
  }
}