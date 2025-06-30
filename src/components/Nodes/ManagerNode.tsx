import React, { useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { AgentNodeData } from '../../types/nodes';
import { useNodesStore } from '../../stores/nodesStore';

interface ManagerNodeData extends AgentNodeData {
  activeAgents?: number;
  totalTasks?: number;
  completedTasks?: number;
  strategy?: string;
}

export const ManagerNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const managerData = data as ManagerNodeData;
  const { setManager, nodes, edges } = useNodesStore();
  const [recentActivities, setRecentActivities] = useState<string[]>([]);

  // Set this node as the manager when it mounts
  useEffect(() => {
    setManager(id);
  }, [id, setManager]);

  // Update recent activities based on connected nodes
  useEffect(() => {
    const connectedEdges = edges.filter(edge => edge.source === id);
    const connectedNodes = nodes.filter(node => 
      connectedEdges.some(edge => edge.target === node.id)
    );

    const activities = connectedNodes.map(node => {
      const nodeData = node.data as AgentNodeData;
      switch (node.type) {
        case 'ui':
          return `Spawned UI Agent: ${nodeData.description || 'Building interface'}`;
        case 'backend':
          return `Spawned Backend Agent: ${nodeData.description || 'Creating API'}`;
        case 'llm':
          return `Spawned LLM Agent: ${nodeData.description || 'Processing AI tasks'}`;
        case 'sandbox':
          return `Spawned Sandbox Agent: ${nodeData.description || 'Setting up environment'}`;
        default:
          return `Spawned ${node.type} Agent`;
      }
    }).slice(-3); // Show last 3 activities

    setRecentActivities(activities);
  }, [id, nodes, edges]);

  return (
    <BaseNode
      id={id}
      type="manager"
      data={managerData}
      selected={selected}
    >
      {/* Manager-specific content */}
      <div className="space-y-3">
        {/* Task Overview */}
        <div className="bg-white rounded-lg p-3 border border-blue-100">
          <h4 className="text-xs font-medium text-blue-800 mb-2">Task Management</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {managerData.activeAgents || 0}
              </div>
              <div className="text-gray-600">Active Agents</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {managerData.completedTasks || 0}/{managerData.totalTasks || 0}
              </div>
              <div className="text-gray-600">Tasks Done</div>
            </div>
          </div>
        </div>

        {/* Strategy */}
        {managerData.strategy && (
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-xs font-medium text-blue-800 mb-1">Current Strategy</div>
            <div className="text-xs text-blue-700">{managerData.strategy}</div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex space-x-2">
          <button className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded transition-colors">
            Plan Tasks
          </button>
          <button className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded transition-colors">
            Spawn Agent
          </button>
        </div>

        {/* Recent Activity */}
        <div className="text-xs">
          <div className="font-medium text-blue-800 mb-1">Recent Activity</div>
          <div className="space-y-1 text-gray-600">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  <span className="truncate">{activity}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <span>Waiting for prompt...</span>
              </div>
            )}
          </div>
        </div>

        {/* Agent Stats */}
        <div className="text-xs bg-blue-50 rounded-lg p-2">
          <div className="font-medium text-blue-800 mb-1">Agent Network</div>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">Connected Agents:</span>
            <span className="font-bold text-blue-800">{edges.filter(edge => edge.source === id).length}</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
};