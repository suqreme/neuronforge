import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ promptName: string }> }
) {
  const { promptName } = await params
  
  try {
    const { variables } = await request.json()
    
    const promptsPath = path.join(process.cwd(), 'prompts')
    const filePath = path.join(promptsPath, `${promptName}.md`)
    
    let prompt = await fs.readFile(filePath, 'utf-8')
    
    // Replace variables in the format {{variable_name}}
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`
        const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
        prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement)
      }
    }
    
    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Error loading prompt:', error)
    return NextResponse.json(
      { error: `Failed to load prompt: ${promptName}` },
      { status: 500 }
    )
  }
}