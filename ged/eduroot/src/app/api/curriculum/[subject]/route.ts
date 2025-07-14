import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  
  try {
    const curriculumPath = path.join(process.cwd(), 'curriculum')
    const filePath = path.join(curriculumPath, `${subject.toLowerCase()}.json`)
    
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const curriculum = JSON.parse(fileContent)
    
    return NextResponse.json(curriculum)
  } catch (error) {
    console.error('Error loading curriculum:', error)
    return NextResponse.json(
      { error: `Failed to load curriculum for subject: ${subject}` },
      { status: 500 }
    )
  }
}