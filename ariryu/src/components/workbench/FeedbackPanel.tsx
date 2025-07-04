import React, { useState, useEffect } from 'react';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useFileContext } from '../../stores/fileContextStore';
import { useLogStore } from '../../stores/logStore';
import { useMemoryStore } from '../../stores/memoryStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';

interface FeedbackPanelProps {
  className?: string;
}

type FeedbackTarget = {
  type: 'file' | 'plan' | 'log' | 'memory';
  id: string;
  display: string;
  context?: string;
};

export function FeedbackPanel({ className = '' }: FeedbackPanelProps) {
  const {
    feedbacks,
    addFeedback,
    getFeedbacksForTarget,
    getFeedbackSummary,
    getRecentFeedbacks,
    clearAllFeedbacks
  } = useFeedbackStore();
  
  const { getAllFiles } = useFileContext();
  const { logs } = useLogStore();
  const { getRecentMemory } = useMemoryStore();
  const { sendMessage } = useMessageBus();
  
  const [selectedTarget, setSelectedTarget] = useState<FeedbackTarget | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState<number>(3);
  const [category, setCategory] = useState<'quality' | 'usability' | 'accuracy' | 'style' | 'performance'>('quality');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'give' | 'history' | 'summary'>('give');
  
  // Get all possible feedback targets
  const getAvailableTargets = (): FeedbackTarget[] => {
    const targets: FeedbackTarget[] = [];
    
    // File targets
    const files = Object.values(getAllFiles());
    files.forEach(file => {
      targets.push({
        type: 'file',
        id: file.path,
        display: `📄 ${file.path}`,
        context: `${file.language} • ${file.size} chars • by ${file.lastUpdatedBy}`
      });
    });
    
    // Recent log targets (last 10 significant logs)
    const significantLogs = logs
      .filter(log => log.level === 'error' || log.level === 'warn' || log.source.includes('Claude'))
      .slice(-10);
    
    significantLogs.forEach(log => {
      targets.push({
        type: 'log',
        id: log.id || `${log.timestamp}-${log.source}`,
        display: `📋 ${log.source}: ${log.message.substring(0, 40)}...`,
        context: `${log.level} • ${new Date(log.timestamp).toLocaleTimeString()}`
      });
    });
    
    // Recent memory targets
    const recentMemories = getRecentMemory(10);
    recentMemories.forEach(memory => {
      targets.push({
        type: 'memory',
        id: memory.id,
        display: `🧠 ${memory.content.substring(0, 40)}...`,
        context: `${memory.type} • ${new Date(memory.timestamp).toLocaleTimeString()}`
      });
    });
    
    return targets.sort((a, b) => a.display.localeCompare(b.display));
  };
  
  const availableTargets = getAvailableTargets();
  const recentFeedbacks = getRecentFeedbacks(20);
  const feedbackSummary = getFeedbackSummary();
  
  const handleSubmitFeedback = async () => {
    if (!selectedTarget || !feedbackText.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const feedbackEntry = {
        id: crypto.randomUUID(),
        type: selectedTarget.type,
        target: selectedTarget.id,
        feedback: feedbackText.trim(),
        rating,
        category,
        source: 'user' as const,
        timestamp: Date.now(),
        context: selectedTarget.context || '',
        metadata: {
          targetDisplay: selectedTarget.display,
          userAgent: navigator.userAgent.substring(0, 50)
        }
      };
      
      // Add to feedback store
      addFeedback(feedbackEntry);
      
      // Add to memory store for Claude integration
      useMemoryStore.getState().addMemory(
        `User feedback on ${selectedTarget.display}: "${feedbackText.trim()}" (${rating}/5 ${category})`,
        'feedback',
        {
          feedbackId: feedbackEntry.id,
          target: selectedTarget.id,
          targetType: selectedTarget.type,
          rating,
          category,
          userFeedback: true
        }
      );
      
      // Send message bus notification
      sendMessage(MessagePatterns.log(
        'USER_FEEDBACK',
        `Feedback submitted for ${selectedTarget.display}: ${rating}/5`,
        ['feedback', 'user-input', category]
      ));
      
      // Send to Claude for immediate awareness
      sendMessage({
        sender: 'USER',
        receiver: 'CLAUDE_PLANNER',
        type: 'feedback',
        content: `New feedback: ${feedbackText.trim()}`,
        priority: rating <= 2 ? 'high' : 'medium',
        metadata: {
          tags: ['user-feedback', category],
          target: selectedTarget.id,
          targetType: selectedTarget.type,
          rating,
          feedbackId: feedbackEntry.id
        }
      });
      
      // Reset form
      setFeedbackText('');
      setRating(3);
      setSelectedTarget(null);
      setCategory('quality');
      
      // Show success in logs
      useLogStore.getState().addLog({
        level: 'success',
        source: 'Feedback Panel',
        message: `✅ Feedback submitted for ${selectedTarget.display} (${rating}/5)`
      });
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Feedback Panel', 
        message: `❌ Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleClearFeedbacks = () => {
    clearAllFeedbacks();
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Feedback Panel',
      message: 'All feedbacks cleared'
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
  
  const getRatingColor = (rating: number): string => {
    if (rating >= 4) return 'text-green-400';
    if (rating >= 3) return 'text-yellow-400';
    if (rating >= 2) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getCategoryEmoji = (category: string): string => {
    const emojiMap = {
      quality: '🔧',
      usability: '👤',
      accuracy: '🎯',
      style: '🎨',
      performance: '⚡'
    };
    return emojiMap[category as keyof typeof emojiMap] || '📝';
  };
  
  const renderGiveFeedbackView = () => (
    <div className="space-y-4">
      {/* Target Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Target for Feedback
        </label>
        <select
          value={selectedTarget?.id || ''}
          onChange={(e) => {
            const target = availableTargets.find(t => t.id === e.target.value);
            setSelectedTarget(target || null);
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Choose a file, log, or memory to give feedback on...</option>
          {availableTargets.map(target => (
            <option key={`${target.type}-${target.id}`} value={target.id}>
              {target.display}
            </option>
          ))}
        </select>
        {selectedTarget?.context && (
          <div className="text-xs text-gray-500 mt-1">{selectedTarget.context}</div>
        )}
      </div>
      
      {/* Feedback Category */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Feedback Category
        </label>
        <div className="flex gap-2 flex-wrap">
          {(['quality', 'usability', 'accuracy', 'style', 'performance'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {getCategoryEmoji(cat)} {cat}
            </button>
          ))}
        </div>
      </div>
      
      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Rating (1-5)
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition-colors ${
                star <= rating ? 'text-yellow-400' : 'text-gray-600'
              } hover:text-yellow-300`}
            >
              ⭐
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-400">
            {rating}/5 - {rating >= 4 ? 'Good' : rating >= 3 ? 'OK' : rating >= 2 ? 'Poor' : 'Bad'}
          </span>
        </div>
      </div>
      
      {/* Feedback Text */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Feedback
        </label>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Describe what works well, what could be improved, or specific suggestions..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none resize-none"
          rows={4}
        />
        <div className="text-xs text-gray-500 mt-1">
          {feedbackText.length}/1000 characters
        </div>
      </div>
      
      {/* Submit Button */}
      <button
        onClick={handleSubmitFeedback}
        disabled={!selectedTarget || !feedbackText.trim() || isSubmitting}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
      >
        {isSubmitting ? '📤 Submitting...' : '📤 Submit Feedback'}
      </button>
    </div>
  );
  
  const renderHistoryView = () => (
    <div className="space-y-3">
      {recentFeedbacks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-lg font-medium mb-2">No feedback yet</p>
          <p className="text-sm">Submit feedback to help Claude improve</p>
        </div>
      ) : (
        recentFeedbacks.map(feedback => (
          <div key={feedback.id} className="bg-gray-800 p-4 rounded border border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getCategoryEmoji(feedback.category)}</span>
                  <span className="font-medium text-blue-300">{feedback.metadata?.targetDisplay || feedback.target}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`text-sm ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 capitalize">
                    {feedback.category}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {feedback.type} • {formatTimeAgo(feedback.timestamp)}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-300 bg-gray-900 p-3 rounded">
              "{feedback.feedback}"
            </div>
          </div>
        ))
      )}
    </div>
  );
  
  const renderSummaryView = () => (
    <div className="space-y-4">
      {/* Overall Stats */}
      <div className="bg-gray-800 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-3">📊 Feedback Overview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Feedback:</span>
            <span className="ml-2 font-semibold text-blue-400">{feedbackSummary.totalFeedbacks}</span>
          </div>
          <div>
            <span className="text-gray-400">Average Rating:</span>
            <span className={`ml-2 font-semibold ${getRatingColor(feedbackSummary.averageRating)}`}>
              {feedbackSummary.averageRating.toFixed(1)}/5
            </span>
          </div>
          <div>
            <span className="text-gray-400">Files with Feedback:</span>
            <span className="ml-2 font-semibold text-green-400">{feedbackSummary.targetCount}</span>
          </div>
          <div>
            <span className="text-gray-400">Low Ratings:</span>
            <span className="ml-2 font-semibold text-red-400">{feedbackSummary.lowRatingCount}</span>
          </div>
        </div>
      </div>
      
      {/* Category Breakdown */}
      {Object.keys(feedbackSummary.categoryBreakdown).length > 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h4 className="font-semibold mb-3">📋 Feedback by Category</h4>
          <div className="space-y-2">
            {Object.entries(feedbackSummary.categoryBreakdown).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{getCategoryEmoji(category)}</span>
                  <span className="text-gray-300 capitalize">{category}</span>
                </div>
                <span className="text-blue-400 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Recent Targets */}
      {feedbackSummary.recentTargets.length > 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h4 className="font-semibold mb-3">🎯 Recently Reviewed</h4>
          <div className="space-y-2">
            {feedbackSummary.recentTargets.map(target => {
              const targetFeedbacks = getFeedbacksForTarget(target);
              const avgRating = targetFeedbacks.reduce((sum, f) => sum + f.rating, 0) / targetFeedbacks.length;
              
              return (
                <div key={target} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{target}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${getRatingColor(avgRating)}`}>
                      {avgRating.toFixed(1)}/5
                    </span>
                    <span className="text-gray-500">({targetFeedbacks.length})</span>
                  </div>
                </div>
              );
            })}
          </div>
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
            💬 User Feedback
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {feedbacks.length} total
            </span>
            {feedbacks.length > 0 && (
              <button
                onClick={handleClearFeedbacks}
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
            { key: 'give', label: '✍️ Give' },
            { key: 'history', label: '📜 History' },
            { key: 'summary', label: '📊 Summary' }
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
        {viewMode === 'give' && renderGiveFeedbackView()}
        {viewMode === 'history' && renderHistoryView()}
        {viewMode === 'summary' && renderSummaryView()}
      </div>
    </div>
  );
}