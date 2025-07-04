import React, { useState, useEffect } from 'react';
import { claudeAutoExecutor } from '../../agents/ClaudeAutoExecutor';
import { ClaudePlan, ClaudeAction } from '../../agents/ClaudePlanner';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus } from '../../stores/messageBus';

interface OrchestrationPanelProps {
  currentPlan?: ClaudePlan;
  onExecutePlan?: (plan: ClaudePlan) => void;
}

export default function OrchestrationPanel({ currentPlan, onExecutePlan }: OrchestrationPanelProps) {
  const [metrics, setMetrics] = useState(claudeAutoExecutor.getOrchestrationMetrics());
  const [activeWorkflows, setActiveWorkflows] = useState(claudeAutoExecutor.getActiveWorkflows());
  const [isAutoExecutionEnabled, setIsAutoExecutionEnabled] = useState(false);

  // Update metrics every second
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(claudeAutoExecutor.getOrchestrationMetrics());
      setActiveWorkflows(claudeAutoExecutor.getActiveWorkflows());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoExecution = () => {
    const newState = !isAutoExecutionEnabled;
    setIsAutoExecutionEnabled(newState);
    
    claudeAutoExecutor.updateSettings({
      enableAutoExecution: newState,
      maxActionsPerRun: 5,
      requireConfirmation: false,
      safeMode: true
    });

    useLogStore.getState().addLog({
      level: 'info',
      source: 'Orchestration Panel',
      message: `Auto-execution ${newState ? 'enabled' : 'disabled'}`
    });
  };

  const handleExecutePlan = async () => {
    if (!currentPlan) return;

    try {
      await claudeAutoExecutor.executeOrchestrationPlan(currentPlan);
      
      useMessageBus.getState().sendMessage({
        sender: 'ORCHESTRATION_PANEL',
        receiver: 'ALL',
        type: 'info',
        content: 'Orchestration plan execution completed',
        priority: 'high',
        metadata: {
          tags: ['orchestration', 'completion']
        }
      });
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Orchestration Panel',
        message: `Plan execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const handleStopExecution = () => {
    claudeAutoExecutor.stop();
    useLogStore.getState().addLog({
      level: 'warn',
      source: 'Orchestration Panel',
      message: 'All orchestration workflows stopped'
    });
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'sequential': return '📋';
      case 'parallel': return '🔄';
      case 'mixed': return '🎯';
      default: return '📋';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_file': return '📝';
      case 'improve_file': return '✨';
      case 'delete_file': return '🗑️';
      case 'ask_user': return '❓';
      case 'debug_issue': return '🔍';
      case 'spawn_agent': return '🤖';
      case 'coordinate_agents': return '🤝';
      case 'analyze_dependencies': return '📊';
      default: return '⚡';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🎯 Orchestration Control Center
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAutoExecution}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isAutoExecutionEnabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isAutoExecutionEnabled ? '🟢 Auto-Exec ON' : '🔴 Auto-Exec OFF'}
          </button>
          {activeWorkflows.length > 0 && (
            <button
              onClick={handleStopExecution}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
            >
              🛑 Stop All
            </button>
          )}
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-3 rounded border border-gray-600">
          <div className="text-sm text-gray-400">Total Executed</div>
          <div className="text-xl font-bold text-blue-400">{metrics.totalExecuted}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded border border-gray-600">
          <div className="text-sm text-gray-400">Success Rate</div>
          <div className="text-xl font-bold text-green-400">
            {metrics.totalExecuted > 0 ? Math.round((metrics.successful / metrics.totalExecuted) * 100) : 0}%
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded border border-gray-600">
          <div className="text-sm text-gray-400">Active Workflows</div>
          <div className="text-xl font-bold text-yellow-400">{metrics.activeWorkflows}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded border border-gray-600">
          <div className="text-sm text-gray-400">Avg Time</div>
          <div className="text-xl font-bold text-purple-400">
            {metrics.averageExecutionTime ? `${Math.round(metrics.averageExecutionTime / 1000)}s` : '-'}
          </div>
        </div>
      </div>

      {/* Active Workflows */}
      {activeWorkflows.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-2 flex items-center gap-2">
            🔄 Active Workflows
          </h4>
          <div className="space-y-2">
            {activeWorkflows.map((workflow) => (
              <div key={workflow.id} className="bg-gray-800 p-3 rounded border border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{workflow.id.slice(0, 8)}...</div>
                  <div className={`text-sm px-2 py-1 rounded ${
                    workflow.status === 'running' ? 'bg-green-600' : 
                    workflow.status === 'paused' ? 'bg-yellow-600' : 
                    'bg-gray-600'
                  }`}>
                    {workflow.status}
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${workflow.progress * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  Progress: {Math.round(workflow.progress * 100)}% | 
                  Est. remaining: {Math.round(workflow.estimatedTimeRemaining / 1000)}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Plan Visualization */}
      {currentPlan && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-semibold flex items-center gap-2">
              {getStrategyIcon(currentPlan.orchestration.executionStrategy)} Current Plan
            </h4>
            <button
              onClick={handleExecutePlan}
              disabled={!isAutoExecutionEnabled}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isAutoExecutionEnabled
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              🚀 Execute Plan
            </button>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-sm text-gray-400">Strategy</div>
                <div className="text-lg font-semibold capitalize">
                  {currentPlan.orchestration.executionStrategy}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Duration</div>
                <div className="text-lg font-semibold">
                  {currentPlan.orchestration.estimatedDuration}min
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Risk Level</div>
                <div className={`text-lg font-semibold capitalize ${
                  currentPlan.orchestration.riskAssessment === 'high' ? 'text-red-400' :
                  currentPlan.orchestration.riskAssessment === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {currentPlan.orchestration.riskAssessment}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm text-gray-400 mb-2">Actions ({currentPlan.actions.length})</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {currentPlan.actions.map((action, index) => (
                  <div key={index} className="bg-gray-700 p-2 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getActionIcon(action.type)}</span>
                        <span className="font-medium">{action.type}</span>
                        {action.target && (
                          <span className="text-blue-400">→ {action.target}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(action.priority || 'medium')}`}>
                          {action.priority || 'medium'}
                        </span>
                        {action.coordination?.parallel && (
                          <span className="text-xs bg-green-600 px-2 py-1 rounded">
                            ⚡ Parallel
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {action.reason}
                    </div>
                    {action.dependencies && action.dependencies.length > 0 && (
                      <div className="text-xs text-yellow-400 mt-1">
                        Dependencies: {action.dependencies.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quality Metrics */}
      {currentPlan && (
        <div className="bg-gray-800 p-4 rounded border border-gray-600">
          <h4 className="text-md font-semibold mb-3">📊 Plan Quality Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-400">Completeness</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${currentPlan.qualityMetrics.planCompleteness * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {Math.round(currentPlan.qualityMetrics.planCompleteness * 100)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Cohesion</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${currentPlan.qualityMetrics.actionCohesion * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {Math.round(currentPlan.qualityMetrics.actionCohesion * 100)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Feasibility</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${currentPlan.qualityMetrics.implementationFeasibility * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {Math.round(currentPlan.qualityMetrics.implementationFeasibility * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}