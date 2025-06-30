# CLAUDE.md

# Claude Code Prompt for NeuronForge Development

## 🎯 Project Overview
You are building **NeuronForge**, a visual AI development platform that transforms natural language prompts into fully functional applications through intelligent agent collaboration. Think "Flowith.io meets Bolt.new" but with live sandboxed execution and visible AI agents working together on a canvas.

**Core Concept**: User enters "Build a recipe app" → System spawns interconnected AI agent nodes → Each agent works visually (UI preview, code editing, API logic) → Complete app runs in integrated sandbox.

## 🏗️ Architecture & Tech Stack

### Primary Technologies
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS (utility-first approach)
- **Canvas Engine**: `@xyflow/react` for node-based interface
- **State Management**: Zustand for predictable state updates
- **Code Editor**: Monaco Editor (VS Code in browser)
- **Sandbox**: WebContainers API or CodeSandbox integration
- **Build Tool**: Vite with hot reload
- **Package Manager**: pnpm (preferred) or npm

### Project Structure
```
neuronforge/
├── src/
│   ├── components/
│   │   ├── Canvas/          # Flow canvas and controls
│   │   ├── Nodes/           # Agent node components
│   │   │   ├── ManagerNode.tsx
│   │   │   ├── UIAgentNode.tsx
│   │   │   ├── BackendNode.tsx
│   │   │   ├── SandboxNode.tsx
│   │   │   └── BaseNode.tsx
│   │   ├── Sandbox/         # Live execution environment
│   │   ├── UI/              # Shared components
│   │   └── Agents/          # Agent logic and AI integration
│   ├── stores/              # Zustand state management
│   │   ├── nodesStore.ts
│   │   ├── projectStore.ts
│   │   └── sandboxStore.ts
│   ├── types/               # TypeScript definitions
│   ├── utils/               # Helper functions
│   ├── hooks/               # Custom React hooks
│   └── services/            # API and external integrations
├── docs/                    # Documentation and PRD
└── public/                  # Static assets
```

## 🧠 Agent Architecture

### Agent Node Types
1. **Manager Agent** 🧑‍💼
   - Parses user prompts into actionable tasks
   - Spawns and coordinates other agents
   - Shows task breakdown and progress

2. **UI Agent** 🎨
   - Generates React components
   - Live preview with iframe or direct rendering
   - Editable code with Monaco Editor

3. **Backend Agent** ⚙️
   - Creates API endpoints and server logic
   - Express.js/Node.js code generation
   - Database schema and integration

4. **LLM Agent** 🤖
   - Handles AI-powered features
   - Prompt engineering and response processing
   - Shows prompt/response flows visually

5. **Sandbox Agent** 🏃‍♂️
   - Manages live application execution
   - File system coordination
   - Dependency management and hot reload

6. **Deployment Agent** 🚀
   - Docker configuration and build scripts
   - Environment setup and deployment configs
   - CI/CD pipeline generation

### Agent Node Template Structure
Each agent node contains:
- **id**: unique agent identifier
- **type**: one of 'manager' | 'ui' | 'backend' | 'llm' | 'sandbox' | 'deployment'
- **memoryPath**: relative path to its CLAUDE.md memory file
- **state**: in-memory representation of current progress and status

### Agent Communication Protocol
```typescript
interface AgentMessage {
  from: string;        // sender agent ID
  to: string | 'all';  // target agent(s)
  type: 'file_update' | 'task_complete' | 'request_help' | 'error';
  payload: any;        // message-specific data
  timestamp: number;
}
```

## 🔄 Development Phases

### ✅ Phase 1-8: Foundation Complete
- Canvas shell with prompt input
- Draggable node system
- Basic agent spawning
- Node-to-node communication
- Live rendering capabilities
- Memory and state management
- Save/load/export functionality

### 🎯 Phase 9: Sandbox Integration (Current Focus)
- WebContainers or CodeSandbox integration
- Real-time file synchronization
- Live application execution
- Hot reload and error handling
- Dependency management

### 🔮 Future Phases
- Advanced agent types (Testing, Security, Performance)
- Multi-project workspace
- Collaboration features
- Template marketplace
- Plugin ecosystem

## 🛠️ Implementation Guidelines

### Code Quality Standards
- **TypeScript First**: Strict typing, no `any` types
- **Component Composition**: Small, focused, reusable components
- **Error Boundaries**: Graceful error handling throughout
- **Performance**: Memo, useCallback, useMemo where appropriate
- **Testing**: Unit tests for utilities, integration tests for flows

### State Management Patterns
```typescript
// Example Zustand store structure
interface NodesStore {
  nodes: AgentNode[];
  connections: Connection[];
  activeProject: Project | null;
  addNode: (node: AgentNode) => void;
  updateNode: (id: string, updates: Partial<AgentNode>) => void;
  sendMessage: (message: AgentMessage) => void;
}
```

### Styling Conventions
- **Tailwind Utilities**: Prefer utility classes over custom CSS
- **Component Variants**: Use class-variance-authority for component variants
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Support system preference and manual toggle
- **Accessibility**: Proper ARIA labels, keyboard navigation

## 🏃‍♂️ Sandbox Integration Specifics

### WebContainers Implementation
```typescript
import { WebContainer } from '@webcontainer/api';

// Sandbox should:
// 1. Boot WebContainer instance
// 2. Sync files from all agents
// 3. Install dependencies automatically
// 4. Provide live preview URL
// 5. Handle build errors gracefully
```

### File System Synchronization
- Real-time updates from agent modifications
- Conflict resolution for simultaneous edits
- Version history and rollback capabilities
- Efficient diff-based updates

### Dependency Management
- Automatic package.json updates
- Dependency conflict resolution
- Version pinning and security scanning
- Custom package registry support

## 🎨 Visual Design Principles

### Canvas Interface
- **Intuitive Flow**: Left-to-right task progression
- **Visual Feedback**: Clear connection lines and data flow
- **Contextual Actions**: Right-click menus, hover states
- **Zoom & Pan**: Smooth navigation for large projects

### Node Design
- **Status Indicators**: Running, complete, error, idle states
- **Progress Visualization**: Step-by-step task completion
- **Expandable Content**: Detailed views without cluttering
- **Live Updates**: Real-time content refreshing

## 🧾 Prompt Format for Claude Tasks

When starting a task, provide this structured format:

**Feature/Component**: [e.g., Sandbox iframe preview]  
**Relevant Files**: [e.g., SandboxNode.tsx, sandboxStore.ts]  
**Agent Type**: [e.g., Sandbox Agent]  
**Objective**: [e.g., Enable hot reload preview with file sync from nodes]  
**Constraints**: [e.g., Use WebContainers API, show error log inline, no backend server]

Claude will respond by:
1. Proposing a plan (when needed)
2. Writing scoped, modular code in one or more files
3. Describing how to test or integrate it
4. Highlighting any dependencies or setup requirements

### Immediate Priorities
1. **Sandbox Integration**: Implement WebContainers for live execution
2. **File Synchronization**: Real-time updates between agents and sandbox
3. **Error Handling**: Robust error boundaries and user feedback
4. **Performance**: Optimize for large projects and multiple agents

### Development Approach
- **Incremental**: Build one feature completely before moving on
- **Test-Driven**: Write tests as you build, not after
- **User-Centric**: Focus on smooth user experience over technical perfection
- **Modular**: Each component should work independently

## 🎯 Specific Implementation Request
[User will specify the exact feature or component to build]

---

## 🧭 Success Criteria
- **Visual**: Users can see AI agents working in real-time
- **Functional**: Generated apps run immediately in sandbox
- **Collaborative**: Agents communicate and coordinate effectively
- **Exportable**: Complete projects can be downloaded or deployed
- **Scalable**: Architecture supports additional agent types and features

**Remember**: Focus on the user experience - they should feel like they're watching intelligent agents collaborate to build their app, with each step visible and the final result immediately usable.

---

## 🚀 Starter Task for Claude

**Feature/Component**: Sandbox Initialization  
**Agent Type**: Sandbox Agent  
**Objective**: Implement SandboxNode.tsx to boot WebContainer, sync files from Zustand, and render live output  
**Relevant Files**: 
- components/Nodes/SandboxNode.tsx
- stores/sandboxStore.ts  
- utils/sandboxHelpers.ts

**Constraints**: 
- Use WebContainers API for in-browser execution
- sandboxStore should manage container lifecycle
- Show live preview + error output in node pane
- Handle file sync from other agent nodes
- Implement hot reload for code changes