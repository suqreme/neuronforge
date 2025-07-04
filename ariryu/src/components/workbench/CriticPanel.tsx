import React, { useState, useEffect } from 'react';
import { useMessageBus } from '../../stores/messageBus';
import { useLogStore } from '../../stores/logStore';
import { useTaskMemoryStore } from '../../stores/taskMemoryStore';
import { callClaudeWithContext } from '../../utils/claudeApi';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large';
  category: string;
  targetFiles: string[];
  implementation: string;
  status?: 'pending' | 'applied' | 'dismissed';
  appliedAt?: number;
}

export function CriticPanel() {
  const { messages, sendMessage } = useMessageBus();
  const { addLog } = useLogStore();
  const { addTaskMemory } = useTaskMemoryStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<string | null>(null);

  // Load suggestions from message bus
  useEffect(() => {
    const suggestionMessages = messages.filter(m => 
      m.sender === 'CRITIC' && m.type === 'suggestions'
    );

    const allSuggestions: Suggestion[] = [];
    
    suggestionMessages.forEach(message => {
      try {
        const parsed = JSON.parse(message.content);
        if (Array.isArray(parsed)) {
          // Handle direct array format
          allSuggestions.push(...parsed.map((s: any) => ({
            ...s,
            status: s.status || 'pending'
          })));
        } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          // Handle wrapped format
          allSuggestions.push(...parsed.suggestions.map((s: any) => ({
            ...s,
            status: s.status || 'pending'
          })));
        }
      } catch (error) {
        // Handle raw text suggestions as fallback
        allSuggestions.push({
          id: `raw-${Date.now()}`,
          title: 'Raw Suggestion',
          description: message.content,
          priority: 'medium',
          estimatedEffort: 'medium',
          category: 'general',
          targetFiles: [],
          implementation: 'Manual implementation required',
          status: 'pending'
        });
      }
    });

    setSuggestions(allSuggestions);
  }, [messages]);

  const applySuggestion = async (suggestion: Suggestion) => {
    setIsApplying(suggestion.id);
    
    try {
      addLog({
        level: 'info',
        source: 'Critic Panel',
        message: `🚀 Applying suggestion: "${suggestion.title}"`
      });

      // Generate implementation plan via Claude
      const implementationPrompt = `You are an expert software engineer. Please implement this improvement suggestion:

SUGGESTION:
Title: ${suggestion.title}
Description: ${suggestion.description}
Category: ${suggestion.category}
Target Files: ${suggestion.targetFiles.join(', ')}
Implementation Guide: ${suggestion.implementation}

Please provide a detailed implementation plan in this JSON format:

{
  "approach": "Brief explanation of the implementation approach",
  "steps": [
    {
      "step": 1,
      "description": "What to do in this step",
      "files": ["file1.tsx", "file2.ts"],
      "changes": "Description of specific changes needed"
    }
  ],
  "codeChanges": [
    {
      "file": "path/to/file.tsx",
      "action": "update|create|delete",
      "changes": "Specific code changes or new file content"
    }
  ],
  "testingNotes": "How to verify the implementation works",
  "risksAndConsiderations": "Potential issues to watch for"
}

Focus on providing actionable, specific implementation details that a developer can follow.

Return ONLY the JSON, no additional text.`;

      const response = await callClaudeWithContext({
        prompt: implementationPrompt,
        system: 'You are a senior software engineer providing detailed implementation plans.',
        temperature: 0.3,
        maxTokens: 2500
      });

      try {
        const implementationPlan = JSON.parse(response);
        
        // Send implementation plan to message bus
        sendMessage({
          sender: 'CRITIC_PANEL',
          receiver: 'ALL',
          type: 'code_patch',
          content: JSON.stringify(implementationPlan, null, 2),
          priority: suggestion.priority,
          metadata: {
            tags: ['implementation', 'code-patch', 'suggestion-applied'],
            suggestionId: suggestion.id,
            suggestionTitle: suggestion.title,
            targetFiles: suggestion.targetFiles
          }
        });

        // Update suggestion status
        setSuggestions(prev => prev.map(s => 
          s.id === suggestion.id 
            ? { ...s, status: 'applied', appliedAt: Date.now() }
            : s
        ));

        // Log success
        addLog({
          level: 'success',
          source: 'Critic Panel',
          message: `✅ Applied suggestion: "${suggestion.title}" - implementation plan generated`
        });

        // Store in task memory
        addTaskMemory({
          agent: 'CRITIC_PANEL',
          taskId: `suggestion-applied-${suggestion.id}`,
          title: `Applied: ${suggestion.title}`,
          content: `Successfully applied improvement suggestion.\n\nImplementation Plan:\n${implementationPlan.approach}\n\nSteps: ${implementationPlan.steps?.length || 0}\nFiles affected: ${suggestion.targetFiles.join(', ')}`,
          type: 'task_complete',
          status: 'completed',
          metadata: {
            importance: suggestion.priority,
            tags: ['suggestion-applied', 'implementation', suggestion.category],
            suggestionId: suggestion.id,
            targetFiles: suggestion.targetFiles
          }
        });

        // Send user feedback to message bus
        sendMessage({
          sender: 'USER',
          receiver: 'CRITIC',
          type: 'feedback',
          content: `✅ Applied suggestion: "${suggestion.title}"`,
          priority: 'medium',
          metadata: {
            tags: ['user-feedback', 'suggestion-applied'],
            suggestionId: suggestion.id,
            action: 'applied'
          }
        });

      } catch (parseError) {
        addLog({
          level: 'warn',
          source: 'Critic Panel',
          message: `⚠️ Generated implementation plan but parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        });
        
        // Send raw response as fallback
        sendMessage({
          sender: 'CRITIC_PANEL',
          receiver: 'ALL',
          type: 'code_patch',
          content: `Implementation plan for: ${suggestion.title}\n\n${response}`,
          priority: suggestion.priority,
          metadata: {
            tags: ['implementation', 'code-patch', 'parse-error'],
            suggestionId: suggestion.id
          }
        });
      }

    } catch (error) {
      addLog({
        level: 'error',
        source: 'Critic Panel',
        message: `❌ Failed to apply suggestion "${suggestion.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsApplying(null);
    }
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    setSuggestions(prev => prev.map(s => 
      s.id === suggestion.id 
        ? { ...s, status: 'dismissed' }
        : s
    ));

    addLog({
      level: 'info',
      source: 'Critic Panel',
      message: `❌ Dismissed suggestion: "${suggestion.title}"`
    });

    // Send user feedback to message bus
    sendMessage({
      sender: 'USER',
      receiver: 'CRITIC',
      type: 'feedback',
      content: `❌ Dismissed suggestion: "${suggestion.title}"`,
      priority: 'low',
      metadata: {
        tags: ['user-feedback', 'suggestion-dismissed'],
        suggestionId: suggestion.id,
        action: 'dismissed'
      }
    });

    // Store dismissal in task memory
    addTaskMemory({
      agent: 'CRITIC_PANEL',
      taskId: `suggestion-dismissed-${suggestion.id}`,
      title: `Dismissed: ${suggestion.title}`,
      content: `User dismissed improvement suggestion: ${suggestion.description}`,
      type: 'task_complete',
      status: 'completed',
      metadata: {
        importance: 'low',
        tags: ['suggestion-dismissed', 'user-decision'],
        suggestionId: suggestion.id,
        action: 'dismissed'
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-900/20 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-900/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };

  const getEffortIcon = (effort: string) => {
    switch (effort) {
      case 'small': return '🟢';
      case 'medium': return '🟡';
      case 'large': return '🔴';
      default: return '⚪';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied': return '✅';
      case 'dismissed': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const completedSuggestions = suggestions.filter(s => s.status !== 'pending');

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-3 justify-between">
        <span className="text-sm text-gray-300">💡 Improvement Suggestions</span>
        <span className="text-xs text-gray-500">
          {pendingSuggestions.length} pending • {completedSuggestions.length} completed
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {suggestions.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">💡</div>
            <p className="text-lg font-medium mb-2">No Suggestions Yet</p>
            <p className="text-sm">Run the Critic Agent to generate improvement suggestions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  ⏳ Pending Suggestions ({pendingSuggestions.length})
                </h3>
                {pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="mb-4 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-4 bg-gray-800">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-white">{suggestion.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(suggestion.priority)}`}>
                            {suggestion.priority}
                          </span>
                          <span className="text-xs" title={`Estimated effort: ${suggestion.estimatedEffort}`}>
                            {getEffortIcon(suggestion.estimatedEffort)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-3">{suggestion.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>📂 {suggestion.category}</span>
                          {suggestion.targetFiles.length > 0 && (
                            <span>🎯 {suggestion.targetFiles.length} files</span>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExpandedSuggestion(
                              expandedSuggestion === suggestion.id ? null : suggestion.id
                            )}
                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-700"
                          >
                            {expandedSuggestion === suggestion.id ? 'Hide' : 'Details'}
                          </button>
                          <button
                            onClick={() => applySuggestion(suggestion)}
                            disabled={isApplying === suggestion.id}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                          >
                            {isApplying === suggestion.id ? '⏳ Applying...' : '✅ Apply'}
                          </button>
                          <button
                            onClick={() => dismissSuggestion(suggestion)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                          >
                            ❌ Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedSuggestion === suggestion.id && (
                      <div className="p-4 bg-gray-900 border-t border-gray-700">
                        <div className="space-y-3 text-xs">
                          {suggestion.targetFiles.length > 0 && (
                            <div>
                              <h5 className="text-gray-400 font-medium mb-1">Target Files:</h5>
                              <div className="flex flex-wrap gap-1">
                                {suggestion.targetFiles.map((file, i) => (
                                  <span key={i} className="bg-gray-800 text-gray-300 px-2 py-1 rounded">
                                    {file}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <h5 className="text-gray-400 font-medium mb-1">Implementation Guide:</h5>
                            <div className="bg-gray-800 p-3 rounded text-gray-300 whitespace-pre-wrap font-mono">
                              {suggestion.implementation}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Completed Suggestions */}
            {completedSuggestions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  📋 Completed Suggestions ({completedSuggestions.length})
                </h3>
                {completedSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="mb-2 p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{getStatusIcon(suggestion.status!)}</span>
                        <span className="text-sm text-gray-300">{suggestion.title}</span>
                        <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      {suggestion.appliedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(suggestion.appliedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}