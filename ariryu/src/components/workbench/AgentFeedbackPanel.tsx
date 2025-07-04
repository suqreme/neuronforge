import React, { useState, useEffect } from 'react';
import { useAgentFeedbackStore, FeedbackUtils } from '../../stores/agentFeedbackStore';
import { useAgentObserver } from '../../utils/agentObserver';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';
import { AgentFeedback, FeedbackSummary } from '../../types';

interface AgentFeedbackPanelProps {
  className?: string;
  selectedAgent?: string;
}

export function AgentFeedbackPanel({ className = '', selectedAgent }: AgentFeedbackPanelProps) {
  const { 
    getFeedbacksForAgent, 
    getRecentFeedbacks, 
    getFeedbackSummary, 
    getTopIssues,
    markFeedbackResolved,
    clearAllFeedbacks
  } = useAgentFeedbackStore();
  
  const { observer, config, updateConfig, status } = useAgentObserver();
  const { addLog } = useLogStore();
  const { sendMessage } = useMessageBus();
  
  const [viewMode, setViewMode] = useState<'agent' | 'recent' | 'summary'>('summary');
  const [selectedFeedbackAgent, setSelectedFeedbackAgent] = useState<string>('');
  
  // Get feedback data
  const recentFeedbacks = getRecentFeedbacks(20);
  const agentFeedbacks = selectedFeedbackAgent ? getFeedbacksForAgent(selectedFeedbackAgent) : [];
  const topIssues = getTopIssues(5);
  
  // Get unique agents with feedback
  const agentsWithFeedback = Array.from(new Set(recentFeedbacks.map(f => f.agent)));
  const feedbackSummary = selectedFeedbackAgent ? getFeedbackSummary(selectedFeedbackAgent) : null;
  
  useEffect(() => {
    if (selectedAgent && agentsWithFeedback.includes(selectedAgent)) {
      setSelectedFeedbackAgent(selectedAgent);
      setViewMode('agent');
    }
  }, [selectedAgent, agentsWithFeedback]);

  const handleToggleObserver = () => {
    const newEnabled = !config.enabled;
    updateConfig({ enabled: newEnabled });
    
    addLog({
      level: 'info',
      source: 'Agent Feedback',
      message: `Agent observer ${newEnabled ? 'enabled' : 'disabled'}`
    });

    sendMessage(MessagePatterns.log(
      'AGENT_FEEDBACK',
      `Agent observation ${newEnabled ? 'enabled' : 'disabled'}`,
      ['feedback', 'observer', newEnabled ? 'enabled' : 'disabled']
    ));
  };

  const handleResolveFeedback = (feedbackId: string) => {
    markFeedbackResolved(feedbackId);
    addLog({
      level: 'info',
      source: 'Agent Feedback',
      message: `Feedback ${feedbackId.slice(0, 8)} marked as resolved`
    });
  };

  const handleClearFeedbacks = () => {
    clearAllFeedbacks();
    addLog({
      level: 'info',
      source: 'Agent Feedback',
      message: 'All feedback cleared'
    });
  };

  const formatTimeAgo = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderFeedbackItem = (feedback: AgentFeedback) => (
    <div key={feedback.id} className="bg-gray-800 p-3 rounded border border-gray-700 mb-2">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{FeedbackUtils.getCategoryEmoji(feedback.category)}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-blue-300">{feedback.agent}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                feedback.qualityScore >= 0.8 ? 'bg-green-600' :
                feedback.qualityScore >= 0.6 ? 'bg-yellow-600' :
                'bg-red-600'
              }`}>
                {Math.round(feedback.qualityScore * 100)}%
              </span>
              <span className={`text-xs ${FeedbackUtils.getSeverityColor(feedback.severity)}`}>
                {feedback.severity}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {feedback.targetFile} • {formatTimeAgo(feedback.timestamp)}
            </div>
          </div>
        </div>
        {!feedback.isResolved && (
          <button
            onClick={() => handleResolveFeedback(feedback.id)}
            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors"
          >
            ✓ Resolve
          </button>
        )}
      </div>
      
      <div className="text-sm text-gray-300 mb-2">
        {feedback.feedback}
      </div>
      
      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div className="text-xs text-gray-400">
          <strong>Suggestions:</strong>
          <ul className="ml-4 mt-1">
            {feedback.suggestions.map((suggestion, index) => (
              <li key={index} className="list-disc">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {feedback.isResolved && (
        <div className="text-xs text-green-400 mt-2">
          ✓ Resolved
        </div>
      )}
    </div>
  );

  const renderSummaryView = () => (
    <div className="space-y-4">
      {/* Observer Status */}
      <div className="bg-gray-800 p-3 rounded border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Observer Status</h4>
          <button
            onClick={handleToggleObserver}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              config.enabled 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {config.enabled ? '🟢 Enabled' : '🔴 Disabled'}
          </button>
        </div>
        {config.enabled && (
          <div className="text-xs text-gray-400 space-y-1">
            <div>Max reviews/hour: {config.maxReviewsPerHour}</div>
            <div>Cooldown: {config.cooldownMinutes} minutes</div>
            <div>Pending reviews: {status.pendingReviews.length}</div>
          </div>
        )}
      </div>

      {/* Top Issues */}
      {topIssues.length > 0 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <h4 className="font-semibold mb-2">Top Issues</h4>
          <div className="space-y-1">
            {topIssues.map(({ category, count }) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{FeedbackUtils.getCategoryEmoji(category)}</span>
                  <span className="capitalize">{category.replace('_', ' ')}</span>
                </div>
                <span className="text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Summaries */}
      {agentsWithFeedback.length > 0 && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <h4 className="font-semibold mb-2">Agent Performance</h4>
          <div className="space-y-2">
            {agentsWithFeedback.map(agent => {
              const summary = getFeedbackSummary(agent);
              return (
                <div key={agent} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-300">{agent}</span>
                    <span className="text-xs text-gray-400">
                      ({summary.totalFeedbacks} reviews)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      summary.averageQualityScore >= 0.8 ? 'bg-green-600' :
                      summary.averageQualityScore >= 0.6 ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}>
                      {Math.round(summary.averageQualityScore * 100)}%
                    </span>
                    <span className="text-xs">
                      {summary.recentTrends.improving ? '📈' : '📉'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderAgentView = () => (
    <div className="space-y-4">
      {/* Agent Selector */}
      <div className="flex items-center gap-2">
        <select
          value={selectedFeedbackAgent}
          onChange={(e) => setSelectedFeedbackAgent(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
        >
          <option value="">Select an agent...</option>
          {agentsWithFeedback.map(agent => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>
      </div>

      {/* Agent Summary */}
      {feedbackSummary && (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <h4 className="font-semibold mb-2">{feedbackSummary.agent} Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Quality Score:</span>
              <span className={`ml-2 font-semibold ${
                feedbackSummary.averageQualityScore >= 0.8 ? 'text-green-400' :
                feedbackSummary.averageQualityScore >= 0.6 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {Math.round(feedbackSummary.averageQualityScore * 100)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Reviews:</span>
              <span className="ml-2 font-semibold text-blue-400">
                {feedbackSummary.totalFeedbacks}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Trend:</span>
              <span className={`ml-2 font-semibold ${
                feedbackSummary.recentTrends.improving ? 'text-green-400' : 'text-red-400'
              }`}>
                {feedbackSummary.recentTrends.improving ? '📈 Improving' : '📉 Declining'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Top Issue:</span>
              <span className="ml-2 font-semibold text-purple-400">
                {feedbackSummary.topIssues[0]?.replace('_', ' ') || 'None'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Agent Feedbacks */}
      {agentFeedbacks.length > 0 ? (
        <div className="space-y-2">
          {agentFeedbacks.slice(0, 10).map(renderFeedbackItem)}
        </div>
      ) : selectedFeedbackAgent ? (
        <div className="text-center text-gray-500 py-4">
          No feedback found for {selectedFeedbackAgent}
        </div>
      ) : null}
    </div>
  );

  const renderRecentView = () => (
    <div className="space-y-2">
      {recentFeedbacks.length > 0 ? (
        recentFeedbacks.slice(0, 15).map(renderFeedbackItem)
      ) : (
        <div className="text-center text-gray-500 py-4">
          <div className="text-4xl mb-2">🤖</div>
          <p>No feedback available yet</p>
          <p className="text-sm text-gray-600 mt-1">
            Enable the observer to start collecting feedback
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-gray-900 text-white rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🎯 Agent Feedback
          </h3>
          <div className="flex items-center gap-2">
            {recentFeedbacks.length > 0 && (
              <button
                onClick={handleClearFeedbacks}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                🗑️ Clear All
              </button>
            )}
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded">
          {[
            { key: 'summary', label: '📊 Summary', icon: '📊' },
            { key: 'agent', label: '🤖 By Agent', icon: '🤖' },
            { key: 'recent', label: '🕒 Recent', icon: '🕒' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key as any)}
              className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                viewMode === key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {viewMode === 'summary' && renderSummaryView()}
        {viewMode === 'agent' && renderAgentView()}
        {viewMode === 'recent' && renderRecentView()}
      </div>
    </div>
  );
}