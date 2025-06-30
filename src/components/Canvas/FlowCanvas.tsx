import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Panel,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ManagerNode, UIAgentNode, BackendNode, SandboxNode } from '../Nodes';
import { useNodesStore } from '../../stores/nodesStore';

// Define custom node types
const nodeTypes = {
  manager: ManagerNode,
  ui: UIAgentNode,
  backend: BackendNode,
  sandbox: SandboxNode,
};

// Welcome node shown when no agents exist
const welcomeNode = {
  id: 'welcome',
  type: 'default',
  position: { x: 400, y: 200 },
  data: { 
    label: (
      <div className="text-center">
        <div className="text-lg font-semibold mb-1">🧠 Welcome to NeuronForge</div>
        <div className="text-sm text-gray-600">Enter a prompt to spawn AI agents</div>
      </div>
    )
  },
  style: {
    width: 300,
    height: 80,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px'
  }
};

export const FlowCanvas: React.FC = () => {
  const { 
    nodes: storeNodes, 
    edges: storeEdges, 
    setNodes: setStoreNodes, 
    setEdges: setStoreEdges,
    addEdge: addStoreEdge,
    addNode
  } = useNodesStore();

  // REMOVED: Sandbox auto-creation - now handled by nodesStore processPrompt

  // Use store nodes or show welcome node if empty
  const displayNodes = storeNodes.length === 0 ? [welcomeNode] : storeNodes;
  const displayEdges = storeEdges;

  const onNodesChange = useCallback((changes: any) => {
    try {
      // Only log when not dimension changes to reduce noise
      if (!changes.every((c: any) => c.type === 'dimensions')) {
        console.log('onNodesChange called with:', changes);
      }
      
      if (storeNodes.length === 0) {
        return;
      }

      // Filter out dimension changes to prevent infinite loops
      const meaningfulChanges = changes.filter((c: any) => 
        c.type !== 'dimensions' || 
        (c.type === 'dimensions' && c.dimensions && 
         (c.dimensions.width !== c.node?.width || c.dimensions.height !== c.node?.height))
      );

      if (meaningfulChanges.length === 0) {
        return; // No meaningful changes, skip update
      }

      // Apply only position and selection changes to prevent dimension loops
      const updatedNodes = storeNodes.map(node => {
        const change = meaningfulChanges.find((c: any) => c.id === node.id);
        if (change) {
          switch (change.type) {
            case 'position':
              if (change.position && typeof change.position === 'object') {
                return { ...node, position: change.position };
              }
              break;
            case 'select':
              return { ...node, selected: change.selected };
            case 'remove':
              return null;
            // Skip dimensions to prevent loops
            default:
              return node;
          }
        }
        return node;
      }).filter(Boolean);
      
      // Only update if there were actual changes
      if (updatedNodes.length !== storeNodes.length || 
          updatedNodes.some((node, i) => node !== storeNodes[i])) {
        setStoreNodes(updatedNodes);
      }
    } catch (error) {
      console.error('Error in onNodesChange:', error);
    }
  }, [storeNodes, setStoreNodes]);

  const onEdgesChange = useCallback((changes: any) => {
    // Apply changes to store
    const updatedEdges = displayEdges.filter((edge, index) => {
      const change = changes.find((c: any) => c.id === edge.id);
      return !change || change.type !== 'remove';
    });
    
    setStoreEdges(updatedEdges);
  }, [displayEdges, setStoreEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('New connection created:', params);
      const newEdge: Edge = {
        id: `${params.source}-to-${params.target}-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        type: 'smoothstep',
        style: { stroke: '#6366f1', strokeWidth: 2 },
        data: { messageType: 'user_connection', messageCount: 0 }
      };
      
      addStoreEdge(newEdge);
    },
    [addStoreEdge]
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        className="bg-gray-50"
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        nodeResizable={true}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="#e5e7eb"
        />
        
        <Controls 
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
        />
        
        <MiniMap 
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
          nodeColor={(node) => {
            switch (node.type) {
              case 'manager': return '#3b82f6';
              case 'ui': return '#10b981';
              case 'backend': return '#f59e0b';
              case 'sandbox': return '#8b5cf6';
              default: return '#6b7280';
            }
          }}
          nodeStrokeWidth={2}
          maskColor="rgba(255, 255, 255, 0.8)"
        />

        <Panel position="top-left" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              storeNodes.length > 0 ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
            }`}></div>
            <span className="text-gray-600">
              {storeNodes.length > 0 ? `${storeNodes.length} Agents Active` : 'Canvas Ready'}
            </span>
          </div>
        </Panel>

        <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>Manager</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>UI Agent</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
              <span>Backend</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
              <span>Sandbox</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};