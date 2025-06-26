import fs from 'fs'
import path from 'path'

export function saveToFile(fileName: string, content: string) {
  const dir = path.resolve(process.cwd(), 'build')

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const filePath = path.join(dir, fileName)
  fs.writeFileSync(filePath, content, 'utf8')
}
