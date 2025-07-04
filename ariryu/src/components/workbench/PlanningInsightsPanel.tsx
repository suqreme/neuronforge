import React, { useState, useEffect } from 'react';
import { usePlanningEnhancer, PlanningInsights } from '../../utils/claudePlanningEnhancer';
import { useAgentFeedbackStore } from '../../stores/agentFeedbackStore';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';

interface PlanningInsightsPanelProps {
  className?: string;
}

export function PlanningInsightsPanel({ className = '' }: PlanningInsightsPanelProps) {
  const { 
    enhancer, 
    generateInsights, 
    getEnhancedContext, 
    updateConfig, 
    status 
  } = usePlanningEnhancer();
  
  const { getRecentFeedbacks } = useAgentFeedbackStore();
  const { addLog } = useLogStore();
  const { sendMessage } = useMessageBus();
  
  const [insights, setInsights] = useState<PlanningInsights | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'insights' | 'config' | 'status'>('insights');
  const [contextSummary, setContextSummary] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  
  // Auto-refresh insights every 5 minutes if enabled
  useEffect(() => {
    if (status.config.enabled) {
      const interval = setInterval(() => {
        handleGenerateInsights();
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [status.config.enabled]);
  
  const handleGenerateInsights = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      addLog({
        level: 'info',
        source: 'Planning Insights',
        message: 'Generating planning insights from agent feedback...'
      });
      
      const newInsights = generateInsights();
      setInsights(newInsights);
      setLastUpdated(Date.now());
      
      // Get enhanced context for display
      const { contextSummary: summary, tokenSafe } = await getEnhancedContext();
      setContextSummary(summary);
      
      addLog({
        level: 'success',
        source: 'Planning Insights',
        message: `Generated insights: ${newInsights.commonPatterns.length} patterns, ${Object.keys(newInsights.agentStrengths).length} agents analyzed`
      });
      
      // Send notification
      sendMessage(MessagePatterns.log(
        'PLANNING_INSIGHTS',
        `Planning insights updated: ${newInsights.commonPatterns.length} patterns found`,
        ['planning', 'insights', 'analysis']
      ));
      
    } catch (error) {
      addLog({
        level: 'error',
        source: 'Planning Insights',
        message: `Failed to generate insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleToggleEnhancer = () => {
    const newEnabled = !status.config.enabled;
    updateConfig({ enabled: newEnabled });
    
    addLog({
      level: 'info',
      source: 'Planning Insights',
      message: `Planning enhancer ${newEnabled ? 'enabled' : 'disabled'}`
    });
  };
  
  const handleUpdateConfig = (key: string, value: any) => {
    updateConfig({ [key]: value });
    
    addLog({
      level: 'info',
      source: 'Planning Insights',
      message: `Updated config: ${key} = ${value}`
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
  
  const formatNextAllowedTime = (timestamp: number): string => {
    const minutes = Math.ceil((timestamp - Date.now()) / 60000);
    if (minutes <= 0) return 'Now available';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };
  
  const renderInsightsView = () => {
    if (!insights) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">🎯</div>
          <p>No planning insights generated yet</p>
          <p className="text-sm text-gray-600 mt-2">
            Need at least {status.config.minFeedbacksForAnalysis} feedbacks to generate insights
          </p>
          <button
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate Insights'}
          </button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-lg">Planning Summary</h4>
            <div className="text-xs text-gray-400">
              Updated {formatTimeAgo(lastUpdated)}
            </div>
          </div>
          <div className="text-sm text-gray-300">
            {contextSummary || 'No significant patterns detected'}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Estimated tokens: {insights.tokenUsageEstimate}
          </div>
        </div>
        
        {/* Common Patterns */}
        {insights.commonPatterns.length > 0 && (
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h4 className="font-semibold mb-3">🔍 Common Patterns</h4>
            <div className="space-y-2">
              {insights.commonPatterns.map((pattern, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">⚠️</span>
                  <span className="text-gray-300">{pattern}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Agent Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h4 className="font-semibold mb-3 text-green-400">💪 Agent Strengths</h4>
            <div className="space-y-3">
              {Object.entries(insights.agentStrengths).map(([agent, strengths]) => (
                <div key={agent} className="text-sm">
                  <div className="font-medium text-blue-300 mb-1">{agent}</div>
                  <div className="ml-2 space-y-1">
                    {strengths.map((strength, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-300">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Weaknesses */}
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h4 className="font-semibold mb-3 text-red-400">⚠️ Agent Weaknesses</h4>
            <div className="space-y-3">
              {Object.entries(insights.agentWeaknesses).map(([agent, weaknesses]) => (
                <div key={agent} className="text-sm">
                  <div className="font-medium text-blue-300 mb-1">{agent}</div>
                  <div className="ml-2 space-y-1">
                    {weaknesses.map((weakness, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-red-400">⚠️</span>
                        <span className="text-gray-300">{weakness}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Quality Trends */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h4 className="font-semibold mb-3">📈 Quality Trends</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(insights.qualityTrends).map(([agent, trend]) => (
              <div key={agent} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-300">{agent}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    trend === 'improving' ? 'bg-green-600' :
                    trend === 'declining' ? 'bg-red-600' :
                    'bg-gray-600'
                  }`}>
                    {trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '📊'} {trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Security & Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Security Concerns */}
          {insights.securityConcerns.length > 0 && (
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <h4 className="font-semibold mb-3 text-red-400">🔒 Security Concerns</h4>
              <div className="space-y-2">
                {insights.securityConcerns.map((concern, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-red-400">🔒</span>
                    <span className="text-gray-300">{concern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Performance Issues */}
          {insights.performanceIssues.length > 0 && (
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <h4 className="font-semibold mb-3 text-yellow-400">⚡ Performance Issues</h4>
              <div className="space-y-2">
                {insights.performanceIssues.map((issue, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-400">⚡</span>
                    <span className="text-gray-300">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Recommended Pairings */}
        {insights.recommendedPairings.length > 0 && (
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h4 className="font-semibold mb-3">🤝 Recommended Agent Pairings</h4>
            <div className="space-y-3">
              {insights.recommendedPairings.map((pairing, index) => (
                <div key={index} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-300 font-medium">{pairing.agent1}</span>
                    <span className="text-gray-400">+</span>
                    <span className="text-blue-300 font-medium">{pairing.agent2}</span>
                  </div>
                  <div className="text-gray-300 ml-2">{pairing.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Best Practices */}
        {insights.bestPractices.length > 0 && (
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h4 className="font-semibold mb-3 text-green-400">📚 Best Practices</h4>
            <div className="space-y-2">
              {insights.bestPractices.map((practice, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">📚</span>
                  <span className="text-gray-300">{practice}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderConfigView = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">Configuration</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Planning Calls per Hour
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={status.config.maxPlanningCallsPerHour}
              onChange={(e) => handleUpdateConfig('maxPlanningCallsPerHour', parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Feedbacks for Analysis
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={status.config.minFeedbacksForAnalysis}
              onChange={(e) => handleUpdateConfig('minFeedbacksForAnalysis', parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Quality Threshold (0-1)
            </label>
            <input
              type="number"
              min="0.1"
              max="1"
              step="0.1"
              value={status.config.qualityThreshold}
              onChange={(e) => handleUpdateConfig('qualityThreshold', parseFloat(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Cooldown Minutes
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={status.config.cooldownMinutes}
              onChange={(e) => handleUpdateConfig('cooldownMinutes', parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderStatusView = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">Enhancer Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Enabled:</span>
            <span className={status.config.enabled ? 'text-green-400' : 'text-red-400'}>
              {status.config.enabled ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Can enhance:</span>
            <span className={status.canEnhance ? 'text-green-400' : 'text-red-400'}>
              {status.canEnhance ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Enhancement count:</span>
            <span className="text-gray-300">{status.history.enhancementCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Hourly count:</span>
            <span className="text-gray-300">
              {status.history.hourlyEnhancementCount}/{status.config.maxPlanningCallsPerHour}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Next allowed:</span>
            <span className="text-gray-300">
              {formatNextAllowedTime(status.nextAllowedTime)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">Feedback Stats</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total feedbacks:</span>
            <span className="text-gray-300">{getRecentFeedbacks(1000).length}</span>
          </div>
          <div className="flex justify-between">
            <span>Quality feedbacks:</span>
            <span className="text-gray-300">
              {getRecentFeedbacks(1000).filter(f => f.qualityScore >= status.config.qualityThreshold).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Unique agents:</span>
            <span className="text-gray-300">
              {new Set(getRecentFeedbacks(1000).map(f => f.agent)).size}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className={`bg-gray-900 text-white rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🎯 Planning Insights
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleEnhancer}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                status.config.enabled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {status.config.enabled ? '🟢 Enabled' : '🔴 Disabled'}
            </button>
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating || !status.canEnhance}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
            >
              {isGenerating ? '⏳ Generating...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
        
        {/* View Mode Selector */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded">
          {[
            { key: 'insights', label: '📊 Insights' },
            { key: 'config', label: '⚙️ Config' },
            { key: 'status', label: '📈 Status' }
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
        {viewMode === 'insights' && renderInsightsView()}
        {viewMode === 'config' && renderConfigView()}
        {viewMode === 'status' && renderStatusView()}
      </div>
    </div>
  );
}