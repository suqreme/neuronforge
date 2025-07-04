import React, { useState, useEffect } from 'react';
import { useTokenBudgetStore, TokenBudgetUtils } from '../../stores/tokenBudgetStore';

interface TokenBudgetPanelProps {
  className?: string;
}

export function TokenBudgetPanel({ className = '' }: TokenBudgetPanelProps) {
  const {
    config,
    usage,
    getAnalytics,
    getStatus,
    getDegradationLevel,
    getRemainingTokens,
    getTimeUntilReset,
    formatUsageDisplay,
    resetDailyUsage,
    updateConfig,
    triggerEmergencyShutdown,
    clearEmergencyShutdown,
    autoRecovery
  } = useTokenBudgetStore();

  const [analytics, setAnalytics] = useState(() => getAnalytics());
  const [showConfig, setShowConfig] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  // Update analytics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics(getAnalytics());
      autoRecovery(); // Run auto-recovery check
    }, 30000);

    return () => clearInterval(interval);
  }, [getAnalytics, autoRecovery]);

  // Update analytics when usage changes
  useEffect(() => {
    setAnalytics(getAnalytics());
  }, [usage.currentUsage, getAnalytics]);

  const status = getStatus();
  const degradationLevel = getDegradationLevel();
  const statusEmoji = TokenBudgetUtils.getStatusEmoji(status);
  const statusColor = TokenBudgetUtils.getStatusColor(status);
  const degradationDescription = TokenBudgetUtils.getDegradationDescription(degradationLevel);
  const timeUntilReset = getTimeUntilReset();
  const remainingTokens = getRemainingTokens();

  const handleConfigUpdate = () => {
    updateConfig(localConfig);
    setShowConfig(false);
  };

  const handleEmergencyAction = () => {
    if (usage.isEmergencyShutdown) {
      clearEmergencyShutdown();
    } else {
      triggerEmergencyShutdown();
    }
  };

  const getProgressBarColor = () => {
    if (status === 'emergency') return 'bg-red-600';
    if (status === 'critical') return 'bg-red-500';
    if (status === 'warning') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressBarWidth = () => {
    return Math.min(100, analytics.usagePercentage * 100);
  };

  return (
    <div className={`bg-gray-900 text-white p-4 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{statusEmoji}</span>
          <h3 className="text-lg font-semibold">Token Budget</h3>
          <span className={`text-sm px-2 py-1 rounded ${statusColor} bg-opacity-20`}>
            {status.toUpperCase()}
          </span>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-gray-400 hover:text-white text-sm"
        >
          ⚙️ Config
        </button>
      </div>

      {/* Main Status Display */}
      <div className="space-y-4">
        {/* Usage Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Daily Usage</span>
            <span className={statusColor}>
              {Math.round(analytics.usagePercentage * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${getProgressBarWidth()}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {formatUsageDisplay()}
          </div>
        </div>

        {/* Status Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-gray-400">Remaining</div>
            <div className="font-mono">{remainingTokens.toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-400">Reset In</div>
            <div className="font-mono">
              {TokenBudgetUtils.formatTimeUntilReset(timeUntilReset)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-400">Requests</div>
            <div className="font-mono">{usage.requestCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-400">Avg Size</div>
            <div className="font-mono">{Math.round(analytics.averageRequestSize)}</div>
          </div>
        </div>

        {/* Degradation Status */}
        {degradationLevel !== 'none' && (
          <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400">⚠️</span>
              <span className="font-medium text-yellow-200">
                {degradationLevel.charAt(0).toUpperCase() + degradationLevel.slice(1)} Degradation
              </span>
            </div>
            <div className="text-sm text-yellow-100">
              {degradationDescription}
            </div>
          </div>
        )}

        {/* Emergency Shutdown Status */}
        {usage.isEmergencyShutdown && (
          <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400">🚨</span>
              <span className="font-medium text-red-200">Emergency Shutdown Active</span>
            </div>
            <div className="text-sm text-red-100 mb-2">
              All AI operations have been disabled due to excessive token usage.
            </div>
            <button
              onClick={handleEmergencyAction}
              className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
            >
              Clear Emergency Shutdown
            </button>
          </div>
        )}

        {/* Projected Usage Warning */}
        {analytics.projectedDailyUsage > config.dailyLimit * 0.9 && !usage.isEmergencyShutdown && (
          <div className="bg-orange-900 bg-opacity-50 border border-orange-600 rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-orange-400">📈</span>
              <span className="font-medium text-orange-200">High Usage Projected</span>
            </div>
            <div className="text-sm text-orange-100">
              Current usage rate suggests you may exceed daily limit. Consider reducing AI operations.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={resetDailyUsage}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded"
            disabled={usage.currentUsage === 0}
          >
            Reset Usage
          </button>
          {!usage.isEmergencyShutdown && status === 'critical' && (
            <button
              onClick={handleEmergencyAction}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded"
            >
              Emergency Stop
            </button>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
          <h4 className="font-medium">Budget Configuration</h4>
          
          <div className="space-y-2">
            <label className="block text-sm">
              Daily Limit (tokens)
              <input
                type="number"
                value={localConfig.dailyLimit}
                onChange={(e) => setLocalConfig({ ...localConfig, dailyLimit: parseInt(e.target.value) })}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                min="1000"
                max="1000000"
              />
            </label>

            <label className="block text-sm">
              Warning Threshold (%)
              <input
                type="number"
                value={Math.round(localConfig.warningThreshold * 100)}
                onChange={(e) => setLocalConfig({ ...localConfig, warningThreshold: parseInt(e.target.value) / 100 })}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                min="50"
                max="95"
              />
            </label>

            <label className="block text-sm">
              Critical Threshold (%)
              <input
                type="number"
                value={Math.round(localConfig.criticalThreshold * 100)}
                onChange={(e) => setLocalConfig({ ...localConfig, criticalThreshold: parseInt(e.target.value) / 100 })}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                min="80"
                max="99"
              />
            </label>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emergencyShutdown"
                checked={localConfig.emergencyShutdownEnabled}
                onChange={(e) => setLocalConfig({ ...localConfig, emergencyShutdownEnabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="emergencyShutdown" className="text-sm">
                Enable Emergency Shutdown
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="degradation"
                checked={localConfig.degradationEnabled}
                onChange={(e) => setLocalConfig({ ...localConfig, degradationEnabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="degradation" className="text-sm">
                Enable Progressive Degradation
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfigUpdate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded"
            >
              Apply Changes
            </button>
            <button
              onClick={() => {
                setLocalConfig(config);
                setShowConfig(false);
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact token budget indicator for use in headers/toolbars
 */
export function TokenBudgetIndicator({ className = '' }: { className?: string }) {
  const { getAnalytics, getStatus } = useTokenBudgetStore();
  const [analytics, setAnalytics] = useState(() => getAnalytics());

  useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics(getAnalytics());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [getAnalytics]);

  const status = getStatus();
  const statusEmoji = TokenBudgetUtils.getStatusEmoji(status);
  const statusColor = TokenBudgetUtils.getStatusColor(status);
  const percentage = Math.round(analytics.usagePercentage * 100);

  const getIndicatorColor = () => {
    if (status === 'emergency') return 'bg-red-600';
    if (status === 'critical') return 'bg-red-500';
    if (status === 'warning') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm">{statusEmoji}</span>
      <div className="flex items-center gap-1">
        <div className="w-8 bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getIndicatorColor()}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <span className={`text-xs font-mono ${statusColor}`}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}