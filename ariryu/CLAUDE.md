# Claude Code Prompt for NeuronForge Development

## 🎯 Project Overview
You are helping build NeuronForge, a next-generation visual AI development platform. The goal is to allow users to create full-stack web applications by simply describing what they want — using AI agents that collaborate and code in real-time.

Each agent is a visual node in a modular interface. The system includes shared memory, real-time streaming of code and logs, and a live sandbox environment powered by a cloud-based modal dev container.

---

## 🧱 Finalized Tech Stack (React-Based)

| Layer             | Stack                                             |
|------------------|---------------------------------------------------|
| Frontend UI      | React 18+, TypeScript, Tailwind CSS, shadcn/ui   |
| Editor           | Monaco Editor (VSCode core)                      |
| Runtime Sandbox  | Modal Sandbox (containerized Bun/Vite instance)  |
| State Mgmt       | Zustand                                           |
| Agent Orchestration | Inngest (event workflows & triggers)         |
| Auth + Storage   | Supabase (Auth, Database, File Storage, Realtime)|
| Logging          | Custom log stream via WebSocket/EventSource      |

---

## 🧠 File Structure Overview

neuronforge/
├── src/
│   ├── components/
│   │   ├── workbench/         # Core layout (MainPanel, LogViewer, Preview, etc.)
│   │   ├── nodes/             # Visual AI agents (UIAgent, BackendAgent, etc.)
│   │   ├── shared/            # UI primitives and helpers
│   ├── stores/                # Zustand state slices (editor, nodes, memory, logs)
│   ├── sandbox/               # Modal runtime management (init, file sync, logs)
│   ├── utils/                 # File simulators, helpers, string formatters
│   ├── types/                 # Global TS types (Node, Agent, File, Memory)
│   ├── routes/                # Page routing
├── public/                    # Assets
├── inngest/                   # Durable agent workflows
└── supabase/                  # Supabase schema, migrations, and policies

---

## 🧠 Agent System Design

| Agent Type      | Role                                                       |
|----------------|------------------------------------------------------------|
| Manager         | Parses user prompt, spawns agents, tracks task status     |
| UI Agent        | Generates React UI (Tailwind + shadcn), streams to editor |
| Backend Agent   | Generates Express/Bun API logic, connects to DB           |
| LLM Agent       | Prompt optimization, spec-to-code reasoning                |
| Deploy Agent    | Outputs Dockerfile, env configs, and build scripts        |
| Memory Agent    | Stores shared instructions, app plan, and schema           |
| Log Agent       | Streams logs into side panel or real-time console         |

---

## ⚙️ Key Functional Expectations

1. Prompt Panel
   - Accepts natural language like “Build a crazy recipe app with 3D drag-drop”
   - Sends to Manager Agent for breakdown

2. Manager Agent
   - Parses and assigns task trees (UI, backend, memory, etc.)
   - Spawns agent nodes on canvas
   - Tracks and displays task progress in real-time

3. Agent Execution
   - Simulate chunked file writing (like AI coding live)
   - Live updates to Monaco Editor
   - File sync → Modal dev container → Vite auto-reload

4. Logs
   - Unified log viewer (tabs: AI Logs, Dev Server Logs)
   - Streamed from agent messages or Modal container

5. Preview
   - Live iframe served from modal container’s dev server
   - Rebuilds when files updated

---

## 🧾 Prompt Format

When building any feature, follow this:

Feature/Component: [e.g. LogViewer]  
Relevant Files: [e.g. src/components/workbench/LogViewer.tsx]  
Context: [e.g. AI logs vs WebContainer logs]  
Objective: [e.g. Show real-time logs grouped by source]  
Constraints: [e.g. Only use Zustand for state]

---

## 🧠 Agent Protocol Format

interface AgentMessage {
  from: string;            // agentId
  to: string | 'all';
  type: 'file_update' | 'log' | 'status_update';
  payload: any;
  timestamp: number;
}

---

## 🔁 Development Strategy

- Modular React components  
- Use Zustand slices for isolated domains  
- Write streaming-friendly code (chunk processing, log batching)  
- Minimize rerenders using memo/hooks  
- Everything testable in isolation  
- Use tailwind/shadcn UI components unless otherwise noted  

---

## 🚨 Special Notes

- We are NOT using WebContainer anymore due to CSP and SharedArrayBuffer issues  
- All sandboxing and previewing is handled via Modal's cloud runtime  
- The system is designed to eventually run as SaaS with token metering or subscriptions  

---

## ✅ Current Build Phase

We are in **Phase 1** — Scaffolding the full React structure with the modular workbench layout.

Focus:
- Build `WorkbenchLayout.tsx`
- Create placeholder `MainPanel`, `LogViewer`, `LivePreview`
- Add Zustand store slices for: `editor`, `logs`, `project`, `agents`
- Route files into `/src/components/workbench/`
