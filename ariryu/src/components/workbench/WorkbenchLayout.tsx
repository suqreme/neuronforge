import React, { useState } from 'react';
import MainPanel from './MainPanel';
import LogViewer from './LogViewer';
import LivePreview from './LivePreview';
import { ControlBar } from './ControlBar';
import AgentDebugMode from '../agents/AgentDebugMode';
import { MemoryPanel } from './MemoryPanel';
import { ChatBox } from './ChatBox';
import { PendingDiffsPanel } from './PendingDiffsPanel';
import { DiffModal } from './DiffModal';
import { ClaudeMemoryPanel } from './ClaudeMemoryPanel';
import { MessageBusViewer } from './MessageBusViewer';
import { FileContextWatcher } from './FileContextWatcher';
import { FileContextPanel } from './FileContextPanel';
import { ClaudePlanningPanel } from './ClaudePlanningPanel';
import { ClaudeCritiquePanel } from './ClaudeCritiquePanel';
import { TaskMemoryDebugger } from './TaskMemoryDebugger';
import { CriticManager } from './CriticManager';
import { CriticPanel } from './CriticPanel';
import { ApiRoutesPanel } from './ApiRoutesPanel';
import { SelfReviewPanel } from './SelfReviewPanel';
import { PlanningInsightsPanel } from './PlanningInsightsPanel';
import { AgentFeedbackPanel } from './AgentFeedbackPanel';
import { SelfCritiquePanel } from './SelfCritiquePanel';
import { TokenBudgetPanel } from './TokenBudgetPanel';
import { previewLogger } from '../../utils/previewLogger';
import { useAgentMemoryStore } from '../../stores/agentMemoryStore';
import { useDiffStore } from '../../stores/diffStore';
import { useMemoryStore } from '../../stores/memoryStore';
import { useMessageBus } from '../../stores/messageBus';
import { useFileContext } from '../../stores/fileContextStore';

const WorkbenchLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'logs' | 'preview' | 'debug' | 'memory' | 'chat' | 'diffs' | 'claude-memory' | 'message-bus' | 'file-context' | 'claude-planning' | 'claude-critique' | 'task-memory' | 'critic-suggestions' | 'api-routes' | 'self-review' | 'planning-insights' | 'agent-feedback' | 'self-critique' | 'token-budget'>('logs');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('system');
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(Math.floor(window.innerWidth * 0.5)); // Start with 50% of screen width
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const { getAllAgents } = useAgentMemoryStore();
  const { getPendingDiffsCount } = useDiffStore();
  const { getMemoryCount } = useMemoryStore();
  const { getMessageCount } = useMessageBus();
  const { getAllRoutes } = useFileContext();

  const handlePanelResize = (e: React.MouseEvent) => {
    if (isDragging) return;
    
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (startX - e.clientX);
      const minWidth = 400; // Minimum panel width for tab comfort
      const maxWidth = window.innerWidth * 0.8; // Maximum 80% of screen
      
      const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setRightPanelWidth(finalWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      previewLogger.logPanelResize(rightPanelWidth);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const togglePanelCollapse = () => {
    const newCollapsed = !isPanelCollapsed;
    setIsPanelCollapsed(newCollapsed);
    previewLogger.logPanelToggle(newCollapsed);
  };

  return (
    <div className="workbench-root h-screen w-full bg-gray-900 text-white flex flex-col">
      {/* Control Bar */}
      <ControlBar />
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Panel - Main Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <MainPanel />
        </div>

        {/* Resizable Divider */}
        {!isPanelCollapsed && (
          <div 
            className={`w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors ${isDragging ? 'bg-blue-500' : ''}`}
            onMouseDown={handlePanelResize}
            title="Drag to resize panel"
          />
        )}

        {/* Right Panel - Tabs for Logs, Preview, and Debug */}
        <div 
          className={`flex flex-col border-l border-gray-700 transition-all duration-300 ${
            isPanelCollapsed ? 'w-0 overflow-hidden' : ''
          }`}
          style={!isPanelCollapsed ? { width: `${rightPanelWidth}px` } : {}}
        >
          {/* Tab Bar */}
          <div className="h-auto bg-gray-800 border-b border-gray-700 flex flex-wrap">
            <button
              onClick={() => setActiveTab('logs')}
              className={`min-w-[80px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'logs' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              Logs
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`min-w-[80px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'preview' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`min-w-[90px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'debug' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🔍 Debug
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`min-w-[95px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'memory' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🧠 Memory
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`min-w-[80px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'chat' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('diffs')}
              className={`min-w-[100px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'diffs' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              📋 Changes
              {getPendingDiffsCount() > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {getPendingDiffsCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('claude-memory')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'claude-memory' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🧠 Claude Memory
              {getMemoryCount() > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {getMemoryCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('message-bus')}
              className={`min-w-[80px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'message-bus' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              📡 Bus
              {getMessageCount() > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-500 text-white rounded-full">
                  {getMessageCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('file-context')}
              className={`min-w-[80px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'file-context' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              📁 Files
            </button>
            <button
              onClick={() => setActiveTab('claude-planning')}
              className={`min-w-[110px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'claude-planning' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🧠 AI Plan
            </button>
            <button
              onClick={() => setActiveTab('claude-critique')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'claude-critique' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🔍 AI Review
            </button>
            <button
              onClick={() => setActiveTab('task-memory')}
              className={`min-w-[110px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'task-memory' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🧠 Memory
            </button>
            <button
              onClick={() => setActiveTab('critic-suggestions')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'critic-suggestions' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              💡 Suggestions
            </button>
            <button
              onClick={() => setActiveTab('api-routes')}
              className={`min-w-[110px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'api-routes' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🌐 API Routes
              {getAllRoutes().length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-500 text-white rounded-full">
                  {getAllRoutes().length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('self-review')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'self-review' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🧠 Self-Review
            </button>
            <button
              onClick={() => setActiveTab('planning-insights')}
              className={`min-w-[130px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'planning-insights' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🎯 Planning Insights
            </button>
            <button
              onClick={() => setActiveTab('agent-feedback')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'agent-feedback' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🎯 Agent Feedback
            </button>
            <button
              onClick={() => setActiveTab('self-critique')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'self-critique' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🔍 Self-Critique
            </button>
            <button
              onClick={() => setActiveTab('token-budget')}
              className={`min-w-[120px] px-3 py-2 text-sm font-medium border-r border-gray-700 hover:bg-gray-700 transition-colors ${
                activeTab === 'token-budget' 
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
                  : 'text-gray-300'
              }`}
            >
              🪙 Token Budget
            </button>
            
            {/* Panel Controls */}
            <div className="flex items-center px-2 space-x-1">
              <button
                onClick={togglePanelCollapse}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title={isPanelCollapsed ? "Show panel" : "Hide panel"}
              >
                {isPanelCollapsed ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'logs' && <LogViewer />}
            {activeTab === 'preview' && <LivePreview />}
            {activeTab === 'debug' && (
              <div className="h-full overflow-auto">
                <AgentDebugMode />
              </div>
            )}
            {activeTab === 'memory' && (
              <div className="h-full flex flex-col">
                {/* Agent Selector */}
                <div className="p-3 bg-gray-800 border-b border-gray-700">
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full bg-gray-700 text-white text-sm border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="system">System</option>
                    <option value="fallback-generator">Fallback Generator</option>
                    {getAllAgents().filter(id => !['system', 'fallback-generator'].includes(id)).map(agentId => (
                      <option key={agentId} value={agentId}>
                        {agentId.charAt(0).toUpperCase() + agentId.slice(1).replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Memory Panel */}
                <div className="flex-1">
                  <MemoryPanel agentId={selectedAgentId} />
                </div>
              </div>
            )}
            {activeTab === 'chat' && <ChatBox />}
            {activeTab === 'diffs' && <PendingDiffsPanel />}
            {activeTab === 'claude-memory' && <ClaudeMemoryPanel />}
            {activeTab === 'message-bus' && <MessageBusViewer />}
            {activeTab === 'file-context' && <FileContextPanel />}
            {activeTab === 'claude-planning' && <ClaudePlanningPanel />}
            {activeTab === 'claude-critique' && <ClaudeCritiquePanel />}
            {activeTab === 'task-memory' && <TaskMemoryDebugger />}
            {activeTab === 'critic-suggestions' && <CriticPanel />}
            {activeTab === 'api-routes' && <ApiRoutesPanel className="h-full" />}
            {activeTab === 'self-review' && <SelfReviewPanel className="h-full" />}
            {activeTab === 'planning-insights' && <PlanningInsightsPanel className="h-full" />}
            {activeTab === 'agent-feedback' && <AgentFeedbackPanel className="h-full" selectedAgent={selectedAgentId} />}
            {activeTab === 'self-critique' && <SelfCritiquePanel className="h-full" />}
            {activeTab === 'token-budget' && <TokenBudgetPanel className="h-full" />}
          </div>
        </div>

        {/* Diff Modal */}
        <DiffModal />

        {/* File Context Watcher */}
        <FileContextWatcher />

        {/* Critic Manager - DISABLED to prevent token usage loops */}
        <CriticManager enablePeriodic={false} intervalMinutes={15} />

        {/* Floating Panel Toggle (when collapsed) */}
        {isPanelCollapsed && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10">
            <button
              onClick={togglePanelCollapse}
              className="p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors border border-gray-600"
              title="Show panel"
            >
              👁️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkbenchLayout;