import React, { useState, useEffect } from 'react';
import { runClaudePlanner, ClaudePlan, ClaudeAction, executeClaudeAction, getPrioritizedActions } from '../../agents/ClaudePlanner';
import { claudeAutoExecutor, AutoExecutionSettings } from '../../agents/ClaudeAutoExecutor';
import { useFileContext } from '../../stores/fileContextStore';
import { useMessageBus } from '../../stores/messageBus';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useMemorySummary } from '../../utils/memorySummarizer';
import { ContextBuilders } from '../../utils/promptContextBuilder';

export function ClaudePlanningPanel() {
  const [currentPlan, setCurrentPlan] = useState<ClaudePlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ClaudeAction | null>(null);
  const [planHistory, setPlanHistory] = useState<ClaudePlan[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoExecutorStatus, setAutoExecutorStatus] = useState(claudeAutoExecutor.getStatus());
  const [showAutoSettings, setShowAutoSettings] = useState(false);
  const [showMemoryContext, setShowMemoryContext] = useState(false);
  const [memoryContext, setMemoryContext] = useState<string>('');
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [lastContextResult, setLastContextResult] = useState<any>(null);
  
  const { getFileStats } = useFileContext();
  const { getMessageCount } = useMessageBus();
  const { getFeedbackSummary, getRecentNegativeFeedback, getRecentPositiveFeedback } = useFeedbackStore();
  const { getContextForClaude, getStats } = useMemorySummary();

  // Auto-refresh planning every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (!isPlanning) {
        runPlanningFlow();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, isPlanning]);

  const runPlanningFlow = async () => {
    setIsPlanning(true);
    try {
      // Generate and store memory context for display
      const currentMemoryContext = getContextForClaude({
        maxFiles: 15,
        maxFeedbacks: 10,
        prioritizeRecent: true,
        includeFileContent: false,
        qualityThreshold: 0.7
      });
      setMemoryContext(currentMemoryContext);
      
      const plan = await runClaudePlanner();
      setCurrentPlan(plan);
      
      // Add to history (keep last 5 plans)
      setPlanHistory(prev => [plan, ...prev].slice(0, 5));
      
      // Queue actions for auto-execution if enabled
      const queuedCount = claudeAutoExecutor.queueActionsFromPlan(plan);
      if (queuedCount > 0) {
        console.log(`🤖 Auto-queued ${queuedCount} actions for execution`);
      }
      
      // Update executor status
      setAutoExecutorStatus(claudeAutoExecutor.getStatus());
      
    } catch (error) {
      console.error('Planning failed:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecuteAction = async (action: ClaudeAction) => {
    setSelectedAction(action);
    try {
      await executeClaudeAction(action);
      // You could update UI to show action was executed
    } catch (error) {
      console.error('Action execution failed:', error);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'improve_file': return '🔧';
      case 'create_file': return '📄';
      case 'delete_file': return '🗑️';
      case 'ask_user': return '❓';
      case 'debug_issue': return '🐛';
      case 'add_feature': return '✨';
      default: return '📋';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-600 text-white';
      case 'medium': return 'bg-yellow-600 text-white';
      case 'low': return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const fileStats = getFileStats();
  const messageCount = getMessageCount();

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">🧠 Claude AI Planner</h3>
            <p className="text-sm text-gray-400">
              Intelligent analysis and action planning for your project
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <button
              onClick={() => setShowMemoryContext(!showMemoryContext)}
              className={`px-3 py-2 text-sm rounded transition-colors ${
                showMemoryContext 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
              title="Show memory context used for planning"
            >
              🧠 Memory
            </button>
            <button
              onClick={() => {
                if (!showContextPreview) {
                  // Generate preview context
                  const previewContext = ContextBuilders.planning(
                    'Preview: Analyze current project state for planning context',
                    []
                  );
                  setLastContextResult(previewContext);
                }
                setShowContextPreview(!showContextPreview);
              }}
              className={`px-3 py-2 text-sm rounded transition-colors ${
                showContextPreview 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
              title="Preview token-safe context that will be sent to Claude"
            >
              📝 Context
            </button>
            <button
              onClick={() => setShowAutoSettings(!showAutoSettings)}
              className={`px-3 py-2 text-sm rounded transition-colors ${
                autoExecutorStatus.settings.enableAutoExecution 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              🤖 Auto {autoExecutorStatus.settings.enableAutoExecution ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={runPlanningFlow}
              disabled={isPlanning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
            >
              {isPlanning ? '🤔 Planning...' : '🧠 Generate Plan'}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-4 text-xs">
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Files</div>
            <div className="font-bold">{fileStats.totalFiles}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Lines</div>
            <div className="font-bold">{fileStats.totalLines}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Messages</div>
            <div className="font-bold">{messageCount}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Memory</div>
            <div className="font-bold">{getStats().totalFeedbacks}F</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Last Plan</div>
            <div className="font-bold">
              {currentPlan ? new Date(currentPlan.timestamp).toLocaleTimeString() : 'None'}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Context Display */}
      {showMemoryContext && memoryContext && (
        <div className="border-b border-gray-700 bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-blue-300">🧠 Memory Context for Planning</h4>
            <span className="text-xs text-gray-400">
              Used in last planning session • {Math.ceil(memoryContext.length / 4)} estimated tokens
            </span>
          </div>
          <div className="bg-gray-900 rounded border border-gray-600 p-3 max-h-64 overflow-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {memoryContext}
            </pre>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            This context helps Claude make informed decisions based on project history and feedback.
          </div>
        </div>
      )}

      {/* Context Preview Display */}
      {showContextPreview && lastContextResult && (
        <div className="border-b border-gray-700 bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-purple-300">📝 Token-Safe Context Preview</h4>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{lastContextResult.tokenCount.toLocaleString()} tokens</span>
              <span>{lastContextResult.stats.totalSources} sources</span>
              {lastContextResult.warnings.length > 0 && (
                <span className="text-yellow-400">⚠️ {lastContextResult.warnings.length} warnings</span>
              )}
            </div>
          </div>
          
          {/* Context Stats */}
          <div className="mb-3 grid grid-cols-4 gap-4 text-xs">
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">User Feedbacks</div>
              <div className="text-purple-300 font-semibold">{lastContextResult.stats.feedbacksIncluded}</div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Memories</div>
              <div className="text-blue-300 font-semibold">{lastContextResult.stats.memoriesIncluded}</div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Files</div>
              <div className="text-green-300 font-semibold">{lastContextResult.stats.filesIncluded}</div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Critiques</div>
              <div className="text-orange-300 font-semibold">{lastContextResult.stats.critiquesIncluded}</div>
            </div>
          </div>
          
          {/* Included/Excluded Sections */}
          <div className="mb-3 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-green-400 mb-1">✅ Included ({lastContextResult.includedSections.length})</div>
              <div className="bg-gray-900 rounded p-2 max-h-20 overflow-auto">
                {lastContextResult.includedSections.map((section: string, idx: number) => (
                  <div key={idx} className="text-gray-300">{section}</div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-red-400 mb-1">❌ Excluded ({lastContextResult.excludedSections.length})</div>
              <div className="bg-gray-900 rounded p-2 max-h-20 overflow-auto">
                {lastContextResult.excludedSections.map((section: string, idx: number) => (
                  <div key={idx} className="text-gray-400">{section}</div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Context Content Preview */}
          <div className="bg-gray-900 rounded border border-gray-600 p-3 max-h-64 overflow-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {lastContextResult.context.length > 2000 
                ? lastContextResult.context.substring(0, 2000) + '\n\n[Context truncated for preview...]'
                : lastContextResult.context
              }
            </pre>
          </div>
          
          {/* Warnings */}
          {lastContextResult.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {lastContextResult.warnings.map((warning: string, idx: number) => (
                <div key={idx} className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">
                  ⚠️ {warning}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-500">
            This preview shows the token-safe context that will be sent to Claude for planning. 
            Context is automatically prioritized by relevance and user feedback.
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!currentPlan && !isPlanning && (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-lg font-medium mb-2">No plan generated yet</p>
            <p className="text-sm">Click "Generate Plan" to analyze your project and get AI suggestions</p>
          </div>
        )}

        {isPlanning && (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-4xl mb-4 animate-pulse">🤔</div>
            <p className="text-lg font-medium mb-2">Claude is analyzing your project...</p>
            <p className="text-sm">This may take a few moments</p>
          </div>
        )}

        {currentPlan && (
          <div className="space-y-6">
            {/* Analysis Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-bold mb-2 text-emerald-400">📊 Analysis Summary</h4>
              <p className="text-sm text-gray-300 mb-3">{currentPlan.analysis}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Confidence: {Math.round(currentPlan.confidence * 100)}%</span>
                <span>Actions: {currentPlan.actions.length}</span>
                <span>Generated: {new Date(currentPlan.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {/* User Feedback Context */}
            {(() => {
              const feedbackSummary = getFeedbackSummary();
              const recentNegative = getRecentNegativeFeedback(3);
              const recentPositive = getRecentPositiveFeedback(2);
              
              if (feedbackSummary.totalFeedbacks > 0) {
                return (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-bold mb-3 text-purple-400">💬 User Feedback Context</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-400">Total Feedback:</span>
                        <span className="text-purple-300">{feedbackSummary.totalFeedbacks}</span>
                        <span className="text-gray-400">Avg Rating:</span>
                        <span className={`font-medium ${
                          feedbackSummary.averageRating >= 4 ? 'text-green-400' :
                          feedbackSummary.averageRating >= 3 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {feedbackSummary.averageRating.toFixed(1)}/5
                        </span>
                      </div>
                      
                      {recentNegative.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-red-400 mb-1">🚨 Recent Issues to Address:</div>
                          <div className="space-y-1">
                            {recentNegative.map(feedback => (
                              <div key={feedback.id} className="text-xs text-gray-300 bg-gray-900 p-2 rounded">
                                <span className="text-red-400">{feedback.metadata?.targetDisplay || feedback.target}</span>
                                <span className="text-gray-500"> ({feedback.rating}/5):</span>
                                <span className="ml-1">"{feedback.feedback}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {recentPositive.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-green-400 mb-1">✅ Recent Successes:</div>
                          <div className="space-y-1">
                            {recentPositive.map(feedback => (
                              <div key={feedback.id} className="text-xs text-gray-300 bg-gray-900 p-2 rounded">
                                <span className="text-green-400">{feedback.metadata?.targetDisplay || feedback.target}</span>
                                <span className="text-gray-500"> ({feedback.rating}/5):</span>
                                <span className="ml-1">"{feedback.feedback}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Actions List */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-bold mb-3 text-blue-400">🎯 Suggested Actions</h4>
              <div className="space-y-3">
                {getPrioritizedActions(currentPlan).map((action, index) => (
                  <div
                    key={index}
                    className="border border-gray-600 rounded-lg p-3 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getActionIcon(action.type)}</span>
                        <div>
                          <div className="font-medium text-white">
                            {action.type.replace('_', ' ').toUpperCase()}
                          </div>
                          {action.target && (
                            <div className="text-xs text-blue-400 font-mono">{action.target}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(action.priority || 'medium')}`}>
                          {action.priority || 'medium'}
                        </span>
                        <button
                          onClick={() => handleExecuteAction(action)}
                          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          Execute
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-2">{action.reason}</p>
                    
                    {action.question && (
                      <div className="text-sm text-blue-300 bg-blue-900/20 p-2 rounded">
                        ❓ {action.question}
                      </div>
                    )}
                    
                    {action.estimatedTime && (
                      <div className="text-xs text-gray-500 mt-2">
                        ⏱️ Estimated time: {action.estimatedTime}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Plan History */}
            {planHistory.length > 1 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-bold mb-3 text-purple-400">📈 Planning History</h4>
                <div className="space-y-2">
                  {planHistory.slice(1).map((plan, index) => (
                    <div
                      key={plan.timestamp}
                      className="flex items-center justify-between p-2 bg-gray-700 rounded text-xs"
                    >
                      <div>
                        <span className="text-gray-300">{plan.analysis.substring(0, 60)}...</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-400">
                        <span>{plan.actions.length} actions</span>
                        <span>{Math.round(plan.confidence * 100)}%</span>
                        <span>{new Date(plan.timestamp).toLocaleTimeString()}</span>
                        <button
                          onClick={() => setCurrentPlan(plan)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}