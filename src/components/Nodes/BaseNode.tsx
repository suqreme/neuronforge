import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentNodeType, AgentNodeData, getNodeTheme, getStatusConfig } from '../../types/nodes';

interface BaseNodeProps {
  id: string;
  type: AgentNodeType;
  data: AgentNodeData;
  children?: React.ReactNode;
  selected?: boolean;
}

export const BaseNode: React.FC<BaseNodeProps> = ({ 
  id, 
  type, 
  data, 
  children, 
  selected = false 
}) => {
  const theme = getNodeTheme(type);
  const statusConfig = getStatusConfig(data.status);

  return (
    <div 
      className={`
        relative bg-white rounded-lg shadow-lg border-2 transition-all duration-200
        ${selected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
        ${theme.accent}
        hover:shadow-xl
        min-w-[280px] max-w-[400px]
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !border-2 !border-gray-400 !bg-white hover:!border-gray-600 transition-colors"
      />

      {/* Header */}
      <div className={`${theme.primary} text-white px-4 py-3 rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{theme.icon}</span>
            <h3 className="font-semibold text-sm">{data.label}</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Status Indicator */}
            <div className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${statusConfig.bgColor} ${statusConfig.color}
              bg-white/20 text-white
            `}>
              {statusConfig.label}
            </div>
            
            {/* Working Animation */}
            {data.status === 'working' && (
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        {data.progress !== undefined && data.progress > 0 && (
          <div className="mt-2 bg-white/20 rounded-full h-1">
            <div 
              className="bg-white h-1 rounded-full transition-all duration-300"
              style={{ width: `${data.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div className={`p-4 ${theme.secondary} rounded-b-lg`}>
        {/* Description */}
        {data.description && (
          <p className={`text-sm mb-3 ${theme.text}`}>
            {data.description}
          </p>
        )}

        {/* Error Display */}
        {data.error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
            <span className="font-medium">Error:</span> {data.error}
          </div>
        )}

        {/* Custom Content */}
        {children && (
          <div className="space-y-3">
            {children}
          </div>
        )}

        {/* Placeholder when no children */}
        {!children && (
          <div className={`text-center py-6 ${theme.text} opacity-60`}>
            <div className="text-2xl mb-2">{theme.icon}</div>
            <div className="text-sm">
              Agent ready to work
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>ID: {id.slice(0, 8)}</span>
          {data.lastUpdated && (
            <span>
              Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !border-2 !border-gray-400 !bg-white hover:!border-gray-600 transition-colors"
      />
    </div>
  );
};