import React, { useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import AgentDebugPanel from './AgentDebugPanel';
import AgentGraphView from './AgentGraphView';
import { runClaudePlanner, ClaudePlan } from '../../agents/ClaudePlanner';

export default function AgentDebugMode() {
  const [activeTab, setActiveTab] = useState<'panels' | 'graph'>('panels');
  const [lastPlan, setLastPlan] = useState<ClaudePlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const agents = useAgentStore((state) => state.agents);
  const { appendLog, setThoughts, updateMemory, sendMessage } = useAgentStore();

  // Demo functions to test the debug system
  const simulateAgentActivity = () => {
    const agentId = 'manager-agent';
    
    // Simulate thoughts update
    setThoughts(agentId, '🔍 Analyzing user prompt for project requirements...');
    
    // Simulate memory update
    updateMemory(agentId, 'currentProject', 'Todo Application');
    updateMemory(agentId, 'taskQueue', ['Create UI components', 'Setup backend', 'Deploy']);
    
    // Simulate log entries
    setTimeout(() => {
      appendLog(agentId, 'Started project analysis');
      setThoughts(agentId, '📋 Breaking down project into manageable tasks...');
    }, 1000);
    
    setTimeout(() => {
      appendLog(agentId, 'Identified 3 main tasks');
      setThoughts(agentId, '👥 Preparing to delegate tasks to specialized agents...');
      
      // Simulate agent communication
      sendMessage({
        from: 'manager-agent',
        to: 'ui-agent',
        type: 'file_update',
        payload: { task: 'Create React todo component' }
      });
    }, 2000);
    
    setTimeout(() => {
      appendLog(agentId, 'Tasks delegated successfully');
      setThoughts(agentId, '✅ All tasks assigned. Monitoring progress...');
    }, 3000);
  };

  const simulateUIAgentWork = () => {
    const agentId = 'ui-agent';
    
    setThoughts(agentId, '🎨 Received task: Create React todo component');
    updateMemory(agentId, 'currentTask', 'Todo Component');
    updateMemory(agentId, 'componentsCreated', ['TodoList', 'TodoItem']);
    
    setTimeout(() => {
      appendLog(agentId, 'Started component generation');
      setThoughts(agentId, '⚡ Generating React component with TypeScript...');
    }, 500);
    
    setTimeout(() => {
      appendLog(agentId, 'TodoList component created');
      setThoughts(agentId, '🔧 Adding Tailwind CSS styling...');
    }, 1500);
    
    setTimeout(() => {
      appendLog(agentId, 'Component styling completed');
      setThoughts(agentId, '📤 Sending component to editor...');
      
      sendMessage({
        from: 'ui-agent',
        to: 'manager-agent',
        type: 'status_update',
        payload: { status: 'component_ready' }
      });
    }, 2500);
  };

  const runClaludePlannerFlow = async () => {
    setIsPlanning(true);
    try {
      console.log('🧠 Running Claude Planner...');
      const plan = await runClaudePlanner();
      setLastPlan(plan);
      console.log('🧠 Claude Plan Generated:', plan);
      
      // Simulate some agent thoughts about the plan
      setThoughts('claude-planner', `📋 Generated ${plan.actions.length} action items with ${Math.round(plan.confidence * 100)}% confidence`);
      appendLog('claude-planner', `Planning complete: ${plan.analysis}`);
      
    } catch (error) {
      console.error('Claude planning failed:', error);
      setThoughts('claude-planner', '❌ Planning failed due to error');
      appendLog('claude-planner', `Planning error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">🔍 Agent Debug Mode</h2>
        <p className="text-gray-400">Real-time visibility into AI agent thoughts, memory, and communications</p>
      </div>

      {/* Demo Controls */}
      <div className="mb-6 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
        <h3 className="text-lg font-bold mb-2">🧪 Demo Controls & AI Planning</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={simulateAgentActivity}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          >
            Simulate Manager Activity
          </button>
          <button
            onClick={simulateUIAgentWork}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
          >
            Simulate UI Agent Work
          </button>
          <button
            onClick={runClaludePlannerFlow}
            disabled={isPlanning}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors flex items-center gap-1"
          >
            {isPlanning ? '🤔' : '🧠'} {isPlanning ? 'Planning...' : 'Plan Next Steps'}
          </button>
        </div>
        
        {/* Plan Results */}
        {lastPlan && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
            <h4 className="text-sm font-bold mb-2 text-emerald-400">📋 Latest Plan Results</h4>
            <p className="text-xs text-gray-300 mb-2">
              <strong>Analysis:</strong> {lastPlan.analysis}
            </p>
            <p className="text-xs text-gray-400 mb-3">
              <strong>Confidence:</strong> {Math.round(lastPlan.confidence * 100)}% • 
              <strong> Actions:</strong> {lastPlan.actions.length} • 
              <strong> High Priority:</strong> {lastPlan.actions.filter(a => a.priority === 'high').length}
            </p>
            
            <div className="space-y-2">
              {lastPlan.actions.slice(0, 3).map((action, index) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded text-white ${
                    action.priority === 'high' ? 'bg-red-600' : 
                    action.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                  }`}>
                    {action.priority}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-white">{action.type.replace('_', ' ').toUpperCase()}</div>
                    <div className="text-gray-400">{action.target && `Target: ${action.target}`}</div>
                    <div className="text-gray-300">{action.reason}</div>
                    {action.question && <div className="text-blue-300">❓ {action.question}</div>}
                  </div>
                </div>
              ))}
              {lastPlan.actions.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{lastPlan.actions.length - 3} more actions...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-4">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('panels')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'panels'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Agent Debug Panels
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'graph'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Agent Graph View
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'panels' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <AgentDebugPanel key={agent.id} agentId={agent.id} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'graph' && (
        <div>
          <AgentGraphView />
        </div>
      )}
    </div>
  );
}