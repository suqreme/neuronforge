import React, { useState, useEffect } from 'react';
import { useSelfCritiqueStore, CritiqueUtils } from '../../stores/selfCritiqueStore';
import { useCritiqueEngine } from '../../agents/ClaudeCritiqueEngine';
import { useFileContext } from '../../stores/fileContextStore';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';
import { useRevisitBehavior } from '../../utils/claudeRevisitBehavior';

interface SelfCritiquePanelProps {
  className?: string;
}

export function SelfCritiquePanel({ className = '' }: SelfCritiquePanelProps) {
  const {
    getRecentCritiques,
    getLowQualityFiles,
    getCritiqueSummary,
    getCommonIssues,
    getTopSuggestions,
    getFileInsights,
    addCritique,
    addAnalysis,
    clearAllCritiques
  } = useSelfCritiqueStore();
  
  const { analyzeAndCritique, updateConfig, getStatus } = useCritiqueEngine();
  const { triggerAnalysis, updateConfig: updateRevisitConfig, getStatus: getRevisitStatus } = useRevisitBehavior();
  const { getAllFiles } = useFileContext();
  const { addLog } = useLogStore();
  const { sendMessage } = useMessageBus();
  
  const [viewMode, setViewMode] = useState<'recent' | 'summary' | 'low-quality' | 'insights'>('recent');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [engineStatus, setEngineStatus] = useState(getStatus());
  const [revisitStatus, setRevisitStatus] = useState(getRevisitStatus());
  const [isTriggering, setIsTriggering] = useState(false);
  
  // Get data
  const recentCritiques = getRecentCritiques(20);
  const lowQualityFiles = getLowQualityFiles(6);
  const critiqueSummary = getCritiqueSummary();
  const commonIssues = getCommonIssues(5);
  const topSuggestions = getTopSuggestions(5);
  const allFiles = Object.values(getAllFiles());
  
  useEffect(() => {
    setEngineStatus(getStatus());
    setRevisitStatus(getRevisitStatus());
  }, [isAnalyzing, isTriggering]);
  
  const handleRunCritique = async (targetFiles?: string[]) => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    try {
      addLog({
        level: 'info',
        source: 'Self-Critique Panel',
        message: `🔍 Starting self-critique analysis${targetFiles ? ` for ${targetFiles.length} files` : ''}...`
      });
      
      const analysis = await analyzeAndCritique(targetFiles);
      
      // Store critiques
      analysis.critiques.forEach(critique => {
        addCritique(critique);
      });
      
      // Store analysis
      addAnalysis(analysis);
      
      addLog({
        level: 'success',
        source: 'Self-Critique Panel',
        message: `✅ Self-critique completed: ${analysis.critiques.length} files analyzed, avg quality: ${Math.round(analysis.overallQuality * 10)}/10`
      });
      
      // Send notification
      sendMessage(MessagePatterns.log(
        'SELF_CRITIQUE',
        `Self-critique analysis completed: ${analysis.critiques.length} files reviewed`,
        ['critique', 'analysis', 'quality-review']
      ));
      
    } catch (error) {
      addLog({
        level: 'error',
        source: 'Self-Critique Panel',
        message: `❌ Self-critique failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAnalyzing(false);
      setSelectedFiles([]);
    }
  };
  
  const handleToggleEngine = () => {
    const newEnabled = !engineStatus.config.enabled;
    updateConfig({ enabled: newEnabled });
    setEngineStatus(getStatus());
    
    addLog({
      level: 'info',
      source: 'Self-Critique Panel',
      message: `Self-critique engine ${newEnabled ? 'enabled' : 'disabled'}`
    });
  };
  
  const handleClearCritiques = () => {
    clearAllCritiques();
    addLog({
      level: 'info',
      source: 'Self-Critique Panel',
      message: 'All self-critiques cleared'
    });
  };
  
  const handleTriggerRevisit = async () => {
    if (isTriggering) return;
    
    setIsTriggering(true);
    
    try {
      addLog({
        level: 'info',
        source: 'Self-Critique Panel',
        message: '🔄 Triggering Claude revisit behavior analysis...'
      });
      
      const result = await triggerAnalysis();
      
      addLog({
        level: 'success',
        source: 'Self-Critique Panel',
        message: `✅ Revisit analysis completed: ${result.actionsTriggered} actions triggered for ${result.filesProcessed.length} files`
      });
      
      if (result.recommendations.length > 0) {
        addLog({
          level: 'info',
          source: 'Self-Critique Panel',
          message: `💡 Recommendations: ${result.recommendations.join(', ')}`
        });
      }
      
    } catch (error) {
      addLog({
        level: 'error',
        source: 'Self-Critique Panel',
        message: `❌ Revisit analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTriggering(false);
    }
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
  
  const renderRecentView = () => (
    <div className="space-y-3">
      {recentCritiques.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-medium mb-2">No self-critiques yet</p>
          <p className="text-sm">Run an analysis to start reviewing code quality</p>
        </div>
      ) : (
        recentCritiques.map((critique) => (
          <div key={critique.id} className="bg-gray-800 p-4 rounded border border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{CritiqueUtils.getFocusAreaEmoji(critique.focusArea)}</span>
                  <span className="font-medium text-blue-300">{critique.filePath}</span>
                  <span className={`text-sm px-2 py-1 rounded font-bold ${
                    critique.quality >= 8 ? 'bg-green-600' :
                    critique.quality >= 6 ? 'bg-yellow-600' :
                    critique.quality >= 4 ? 'bg-orange-600' :
                    'bg-red-600'
                  }`}>
                    {critique.quality}/10
                  </span>
                  <span className="text-xs text-gray-400">
                    {CritiqueUtils.getConfidenceLevel(critique.confidence)} confidence
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {critique.language} • {critique.fileSize} chars • {formatTimeAgo(critique.timestamp)}
                </div>
              </div>
            </div>
            
            {/* Issues */}
            {critique.reasons.length > 0 && (
              <div className="mb-3">
                <div className="text-sm font-medium text-red-300 mb-1">Issues Found:</div>
                <ul className="text-sm text-gray-300 space-y-1">
                  {critique.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Suggestions */}
            {critique.suggestions.length > 0 && (
              <div>
                <div className="text-sm font-medium text-green-300 mb-1">Suggestions:</div>
                <ul className="text-sm text-gray-300 space-y-1">
                  {critique.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">✓</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
  
  const renderSummaryView = () => (
    <div className="space-y-4">
      {/* Overall Stats */}
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">📊 Quality Overview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Reviews:</span>
            <span className="ml-2 font-semibold text-blue-400">{critiqueSummary.totalCritiques}</span>
          </div>
          <div>
            <span className="text-gray-400">Average Quality:</span>
            <span className={`ml-2 font-semibold ${
              critiqueSummary.averageQuality >= 8 ? 'text-green-400' :
              critiqueSummary.averageQuality >= 6 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {critiqueSummary.averageQuality.toFixed(1)}/10
            </span>
          </div>
          <div>
            <span className="text-gray-400">Trend:</span>
            <span className={`ml-2 font-semibold ${
              critiqueSummary.improvementTrends.improving ? 'text-green-400' : 'text-red-400'
            }`}>
              {critiqueSummary.improvementTrends.improving ? '📈 Improving' : '📉 Declining'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Low Quality Files:</span>
            <span className="ml-2 font-semibold text-red-400">{lowQualityFiles.length}</span>
          </div>
        </div>
      </div>
      
      {/* Common Issues */}
      {commonIssues.length > 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h4 className="font-semibold mb-3 text-red-400">🚨 Common Issues</h4>
          <div className="space-y-2">
            {commonIssues.map((issue, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{issue.issue}</span>
                <span className="text-red-400 font-medium">{issue.count} files</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Top Suggestions */}
      {topSuggestions.length > 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h4 className="font-semibold mb-3 text-green-400">💡 Common Suggestions</h4>
          <div className="space-y-2">
            {topSuggestions.map((suggestion, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{suggestion.suggestion}</span>
                <span className="text-green-400 font-medium">{suggestion.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  const renderLowQualityView = () => (
    <div className="space-y-3">
      {lowQualityFiles.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-lg font-medium mb-2">No low quality files</p>
          <p className="text-sm">All recent files meet quality standards</p>
        </div>
      ) : (
        lowQualityFiles.map((critique) => {
          const insights = getFileInsights(critique.filePath);
          return (
            <div key={critique.id} className="bg-gray-800 p-4 rounded border border-red-600">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-400">⚠️</span>
                    <span className="font-medium text-blue-300">{critique.filePath}</span>
                    <span className="text-sm px-2 py-1 rounded font-bold bg-red-600">
                      {critique.quality}/10
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Risk Score: {Math.round(insights.riskScore * 100)}% • {formatTimeAgo(critique.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => handleRunCritique([critique.filePath])}
                  disabled={isAnalyzing}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
                >
                  Re-analyze
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-red-300 font-medium">Primary Issues:</span>
                  <div className="text-gray-300 ml-4">
                    {critique.reasons.slice(0, 3).join(', ')}
                  </div>
                </div>
                
                <div>
                  <span className="text-green-300 font-medium">Recommended Actions:</span>
                  <div className="text-gray-300 ml-4">
                    {insights.improvementSuggestions.slice(0, 2).join(', ') || 'No specific suggestions available'}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
  
  const renderInsightsView = () => (
    <div className="space-y-4">
      {/* Engine Status */}
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">🔧 Engine Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Enabled:</span>
            <span className={engineStatus.config.enabled ? 'text-green-400' : 'text-red-400'}>
              {engineStatus.config.enabled ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Can analyze:</span>
            <span className={engineStatus.canCritique ? 'text-green-400' : 'text-red-400'}>
              {engineStatus.canCritique ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Critiques today:</span>
            <span className="text-gray-300">
              {engineStatus.history.hourlyCritiqueCount}/{engineStatus.config.maxCritiquesPerHour}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Next allowed:</span>
            <span className="text-gray-300">
              {formatNextAllowedTime(engineStatus.nextAllowedTime)}
            </span>
          </div>
        </div>
      </div>
      
      {/* File Selection */}
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">📁 Manual Analysis</h4>
        <div className="space-y-3">
          <div className="max-h-32 overflow-y-auto">
            {allFiles.filter(f => f.language && ['typescript', 'javascript'].includes(f.language)).map(file => (
              <label key={file.path} className="flex items-center gap-2 text-sm py-1">
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.path)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFiles([...selectedFiles, file.path]);
                    } else {
                      setSelectedFiles(selectedFiles.filter(f => f !== file.path));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-gray-300">{file.path}</span>
                <span className="text-xs text-gray-500">({file.size} chars)</span>
              </label>
            ))}
          </div>
          
          <button
            onClick={() => handleRunCritique(selectedFiles.length > 0 ? selectedFiles : undefined)}
            disabled={isAnalyzing || !engineStatus.canCritique}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
          >
            {isAnalyzing ? '🔍 Analyzing...' : `Analyze ${selectedFiles.length > 0 ? `${selectedFiles.length} Selected Files` : 'All Files'}`}
          </button>
        </div>
      </div>
      
      {/* Revisit Behavior */}
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">🔄 Auto-Revisit Behavior</h4>
        <div className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Enabled:</span>
              <span className={revisitStatus.config.enabled ? 'text-green-400' : 'text-red-400'}>
                {revisitStatus.config.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Quality threshold:</span>
              <span className="text-gray-300">{revisitStatus.config.qualityThreshold}/10</span>
            </div>
            <div className="flex justify-between">
              <span>Revisits today:</span>
              <span className="text-gray-300">
                {revisitStatus.history.hourlyRevisitCount}/{revisitStatus.config.maxRevisitsPerHour}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Can revisit:</span>
              <span className={revisitStatus.canRevisit ? 'text-green-400' : 'text-red-400'}>
                {revisitStatus.canRevisit ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => updateRevisitConfig({ enabled: !revisitStatus.config.enabled })}
              className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                revisitStatus.config.enabled 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {revisitStatus.config.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={handleTriggerRevisit}
              disabled={isTriggering || !revisitStatus.canRevisit}
              className="flex-1 px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded transition-colors"
            >
              {isTriggering ? '⏳ Analyzing...' : '🔄 Trigger Now'}
            </button>
          </div>
          
          <div className="text-xs text-gray-500">
            Auto-revisit triggers actions for very low quality files: request review, flag for refactoring, or trigger regeneration.
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
            🔍 Self-Critique
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleEngine}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                engineStatus.config.enabled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {engineStatus.config.enabled ? '🟢 Enabled' : '🔴 Disabled'}
            </button>
            <button
              onClick={() => handleRunCritique()}
              disabled={isAnalyzing || !engineStatus.canCritique}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
            >
              {isAnalyzing ? '⏳ Analyzing...' : '🔄 Analyze'}
            </button>
            {recentCritiques.length > 0 && (
              <button
                onClick={handleClearCritiques}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>
        
        {/* View Mode Selector */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded">
          {[
            { key: 'recent', label: '🕒 Recent' },
            { key: 'summary', label: '📊 Summary' },
            { key: 'low-quality', label: '⚠️ Issues' },
            { key: 'insights', label: '🔧 Settings' }
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
        {viewMode === 'recent' && renderRecentView()}
        {viewMode === 'summary' && renderSummaryView()}
        {viewMode === 'low-quality' && renderLowQualityView()}
        {viewMode === 'insights' && renderInsightsView()}
      </div>
    </div>
  );
}