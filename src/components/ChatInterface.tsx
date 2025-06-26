'use client'

import { useState } from 'react'

export default function ChatInterface({
  agent,
  onCodeUpdate,
  setAnalysis,
  setStack,
  setTasks,
  setFrontendCode,
  setBackendCode,
}: {
  agent: 'frontend' | 'backend' | 'manager'
  onCodeUpdate?: (code: string) => void
  setAnalysis?: (val: string) => void
  setStack?: (val: { frontend: string; backend: string }) => void
  setTasks?: (val: { frontend: string; backend: string }) => void
  setFrontendCode?: (val: string) => void
  setBackendCode?: (val: string) => void
}) {
  const [input, setInput] = useState('')
  const [chat, setChat] = useState<{ sender: 'user' | 'ai'; text: string }[]>([])
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return
    const userMessage = input.trim()
    setChat((c) => [...c, { sender: 'user', text: userMessage }])
    setInput('')
    setLoading(true)

    const res = await fetch(`/api/chat/${agent}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })

    const data = await res.json()
    const reply = data.reply || 'No response.'
    setChat((c) => [...c, { sender: 'ai', text: reply }])
    setLoading(false)

    // Auto update code after chat
    if (onCodeUpdate && data.newCode) {
      onCodeUpdate(data.newCode)
    }

    // For manager — update analysis/stack/tasks/codes
    if (agent === 'manager') {
      if (setAnalysis) setAnalysis(data.analysis || '')
      if (setStack) setStack(data.stack || { frontend: '', backend: '' })
      if (setTasks) setTasks(data.tasks || { frontend: '', backend: '' })
      if (setFrontendCode) setFrontendCode(data.frontend || '')
      if (setBackendCode) setBackendCode(data.backend || '')
    }
  }

  return (
    <div className="border rounded p-4 mb-6">
      <h3 className="font-bold capitalize mb-2">💬 {agent} Agent</h3>
      <div className="max-h-64 overflow-y-auto bg-gray-100 p-2 text-sm mb-2">
        {chat.map((msg, i) => (
          <p key={i} className={msg.sender === 'user' ? 'text-blue-600' : 'text-black'}>
            <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong> {msg.text}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 p-2 border rounded"
          placeholder="Send a message..."
        />
        <button
          onClick={handleSend}
          className="px-3 py-1 bg-black text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
