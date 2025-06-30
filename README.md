# NeuronForge Sandbox Implementation

## Overview
This implementation provides the **Sandbox Agent** functionality for NeuronForge - a WebContainer-based live execution environment that syncs files from other agents and renders applications in real-time.

## Components Created

### 1. SandboxNode.tsx
- **Location**: `src/components/Nodes/SandboxNode.tsx`
- **Features**:
  - WebContainer initialization and lifecycle management
  - Live iframe preview with `srcDoc` fallback
  - Console panel for logs and errors
  - Status indicators and controls
  - Cross-origin isolation support detection

### 2. sandboxStore.ts
- **Location**: `src/stores/sandboxStore.ts`
- **Features**:
  - Zustand store for WebContainer state management
  - File synchronization with other agents
  - Dependency installation and dev server management
  - Comprehensive logging and error handling

### 3. webcontainerHelpers.ts
- **Location**: `src/utils/webcontainerHelpers.ts`
- **Features**:
  - File tree generation for WebContainer mounting
  - Default project template creation
  - Preview HTML generation
  - WebContainer compatibility checking

## Usage

```typescript
import { SandboxNode } from './components/Nodes';

// Basic usage
<SandboxNode 
  id="sandbox-1" 
  data={{ 
    title: "Live Preview", 
    autoStart: true 
  }} 
/>
```

## Key Features

### ✅ WebContainer Integration
- Full WebContainer API integration
- Automatic container lifecycle management
- Support for npm operations and dev server

### ✅ File Synchronization
- Real-time file updates from other agents
- Efficient file tree mounting
- Conflict resolution capabilities

### ✅ Live Preview
- Iframe-based preview with security sandboxing
- Fallback to `srcDoc` for status messages
- Hot reload support

### ✅ Error Handling
- Comprehensive error logging
- Console output display
- WebContainer compatibility detection

### ✅ UI/UX
- Clean, professional interface
- Status indicators and progress feedback
- Collapsible console panel
- Responsive design with Tailwind CSS

## Requirements

### Browser Environment
- Modern browser with SharedArrayBuffer support
- Cross-origin isolation headers required (COOP + COEP)
- HTTPS connection recommended

### Dependencies
- `@webcontainer/api`: WebContainer runtime
- `zustand`: State management
- `react`: UI framework
- `vite-plugin-cross-origin-isolation`: COI headers for development

## 🚀 Deployment

### Cross-Origin Isolation Setup

WebContainer requires Cross-Origin Isolation (COI) headers to work properly. This project includes configuration for multiple deployment platforms:

#### Local Development
```bash
npm run dev
```
The Vite plugin automatically adds the required headers.

#### Vercel
Uses `vercel.json` for COI headers configuration.

#### Netlify  
Uses `netlify.toml` for COI headers configuration.

#### GitHub Pages
Uses GitHub Actions workflow with `_headers` file.

#### Required Headers
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Integration

The SandboxNode integrates with the broader NeuronForge ecosystem:

1. **Agent Communication**: Receives file updates from other agents
2. **State Management**: Centralized store for sandbox state
3. **Live Execution**: Real-time application preview
4. **Export Capability**: Generated files available for download

## Next Steps

1. **Agent Integration**: Connect with UI, Backend, and other agent types
2. **File Watchers**: Implement real-time file sync from agent nodes
3. **Performance**: Optimize for large projects and multiple containers
4. **Templates**: Add project template support