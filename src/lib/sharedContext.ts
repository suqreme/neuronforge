// --- src/lib/sharedContext.ts ---

type ContextType = {
  prompt: string
  analysis: string
  stack: { frontend: string; backend: string }
  tasks: { frontend: string; backend: string }
  code: { frontend: string; backend: string }
  changelog: string[]
}

let context: ContextType = {
  prompt: '',
  analysis: '',
  stack: { frontend: '', backend: '' },
  tasks: { frontend: '', backend: '' },
  code: { frontend: '', backend: '' },
  changelog: [],
}

export function getContext(): ContextType {
  return context
}

export function updateContext(newCtx: Partial<ContextType>) {
  context = {
    ...context,
    ...newCtx,
    stack: { ...context.stack, ...newCtx.stack },
    tasks: { ...context.tasks, ...newCtx.tasks },
    code: { ...context.code, ...newCtx.code },
  }
}

export function updateCode(agent: 'frontend' | 'backend', newCode: string) {
  context.code[agent] = newCode
  context.changelog.push(`${agent} code updated.`)
}

export function logChange(change: string) {
  context.changelog.push(change)
}
