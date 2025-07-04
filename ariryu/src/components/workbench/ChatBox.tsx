import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ClaudeChatOptions, callClaudeWithContext } from '../../utils/claudeApi';
import { useEditorStore } from '../../stores/editorStore';
import { writeAgentFile, writeAgentFileWithCritique } from '../../utils/fileWriter';
import { useToast } from '../ui/Toast';
import { useDiffStore } from '../../stores/diffStore';
import { hasDifferences } from '../../utils/diffUtils';
import { useMemoryStore } from '../../stores/memoryStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../../stores/messageBus';
import { useFileContext } from '../../stores/fileContextStore';
import { useTaskMemoryStore } from '../../stores/taskMemoryStore';
import { runClaudePlanner, ClaudePlan } from '../../agents/ClaudePlanner';
import { claudeAutoExecutor } from '../../agents/ClaudeAutoExecutor';
import OrchestrationPanel from './OrchestrationPanel';

export function ChatBox() {
  const { 
    messages, 
    isAgentTyping, 
    addMessage,
    setAgentTyping,
    getMessagesForContext,
    clearChat 
  } = useChatStore();
  
  const { addToast } = useToast();
  const { addPendingDiff, openDiffModal } = useDiffStore();
  const { openTabs } = useEditorStore();
  const { addMemory } = useMemoryStore();
  const { sendMessage, registerAgent, unregisterAgent } = useMessageBus();
  const { subscribeAgent, unsubscribeAgent } = useFileContext();
  const { addTaskMemory, startSession, getCurrentSession } = useTaskMemoryStore();
  
  const [input, setInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [chatOptions, setChatOptions] = useState<ClaudeChatOptions>({
    includeMemory: true,
    includeFiles: true,
    includeProjectState: true,
    includeTaskMemory: true,
    maxMemoryEntries: 10,
    maxFileContext: 5,
    maxTaskMemory: 5,
    enableActions: true
  });
  const [enableSelfCritique, setEnableSelfCritique] = useState(false);
  const [showOrchestration, setShowOrchestration] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ClaudePlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  // Focus input on mount and register agent
  useEffect(() => {
    inputRef.current?.focus();
    
    // Register Claude agent (with built-in duplicate protection)
    registerAgent(AGENT_TYPES.CLAUDE);
    
    // Subscribe to file context changes
    subscribeAgent(AGENT_TYPES.CLAUDE);
    
    // Send initialization message (only if not recently sent)
    const recentMessages = useMessageBus.getState().getRecentMessages(5);
    const hasRecentInit = recentMessages.some(msg => 
      msg.content.includes('Claude Assistant initialized') && 
      msg.sender === AGENT_TYPES.CLAUDE &&
      (Date.now() - msg.timestamp) < 30000 // Within last 30 seconds
    );
    
    if (!hasRecentInit) {
      sendMessage(MessagePatterns.log(
        AGENT_TYPES.CLAUDE,
        'Claude Assistant initialized and ready for chat',
        ['initialization', 'claude', 'file-context-subscriber']
      ));
    }
    
    // DON'T unregister on unmount to prevent re-registration loops
    // The agent should stay registered even when switching tabs
    return () => {
      // Only unsubscribe from file context, keep agent registered
      unsubscribeAgent(AGENT_TYPES.CLAUDE);
    };
  }, []); // Empty deps - registration should only happen once on mount

  const handleSend = async () => {
    if (!input.trim() || isAgentTyping) return;
    
    const prompt = input.trim();
    setInput('');
    
    // Start a session if none exists and this looks like a task request
    const currentSession = getCurrentSession();
    if (!currentSession && (prompt.length > 10 && (prompt.toLowerCase().includes('create') || prompt.toLowerCase().includes('build') || prompt.toLowerCase().includes('make') || prompt.toLowerCase().includes('implement')))) {
      startSession('CLAUDE', `User Request: ${prompt.substring(0, 100)}...`);
    }
    
    // Add user message
    addMessage(prompt, 'user');
    
    // Add task memory for user request
    addTaskMemory({
      agent: 'CLAUDE',
      taskId: `user-request-${Date.now()}`,
      title: `User Request: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
      content: `User asked: ${prompt}`,
      type: 'task_start',
      status: 'active',
      metadata: {
        importance: 'high',
        tags: ['user-request', 'chat']
      }
    });
    
    // Send message to bus
    sendMessage({
      sender: AGENT_TYPES.USER,
      receiver: AGENT_TYPES.CLAUDE,
      type: 'request',
      content: prompt,
      priority: 'high',
      metadata: { tags: ['user-request', 'chat'] }
    });
    
    // Add to memory
    addMemory(
      `User request: ${prompt}`,
      'user_request',
      { 
        importance: 'high',
        tags: ['chat', 'user-input']
      }
    );
    
    // Show typing indicator
    setAgentTyping(true);
    
    try {
      // Get conversation context safely
      const conversationHistory = getMessagesForContext();
      
      // Use the simple Claude call instead of actions
      let claudeResponse: string;
      
      try {
        // Try the simple Claude API call
        claudeResponse = await callClaudeWithContext(prompt, conversationHistory, chatOptions);
      } catch (claudeError) {
        console.error('Claude API error:', claudeError);
        claudeResponse = `I encountered an error: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}. Please try again.`;
      }
      
      // Add response
      addMessage(claudeResponse, 'agent');
      
      // Send response to message bus
      sendMessage({
        sender: AGENT_TYPES.CLAUDE,
        receiver: AGENT_TYPES.USER,
        type: 'response',
        content: claudeResponse.length > 200 ? claudeResponse.substring(0, 200) + '...' : claudeResponse,
        priority: 'medium',
        metadata: { tags: ['claude-response', 'chat'] }
      });
      
      // Add Claude's response to memory
      addMemory(
        `Claude response: ${claudeResponse.substring(0, 200)}${claudeResponse.length > 200 ? '...' : ''}`,
        'claude_response',
        { 
          importance: 'medium',
          tags: ['chat', 'claude-response']
        }
      );
      
      setAgentTyping(false);
    } catch (error) {
      setAgentTyping(false);
      addMessage(`Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'agent');
      console.error('Claude chat error:', error);
    }
  };

  const handleGeneratePlan = async () => {
    if (isPlanning) return;
    
    setIsPlanning(true);
    addMessage('🎯 Generating orchestration plan based on current project state...', 'agent');
    
    try {
      const plan = await runClaudePlanner();
      setCurrentPlan(plan);
      setShowOrchestration(true);
      
      addMessage(
        `🚀 **Orchestration Plan Generated**\n\n` +
        `**Strategy:** ${plan.orchestration.executionStrategy}\n` +
        `**Actions:** ${plan.actions.length}\n` +
        `**Estimated Duration:** ${plan.orchestration.estimatedDuration} minutes\n` +
        `**Confidence:** ${Math.round(plan.confidence * 100)}%\n\n` +
        `**Analysis:** ${plan.analysis}\n\n` +
        `Check the orchestration panel to review and execute the plan.`,
        'agent'
      );
      
      addToast({
        message: 'Orchestration plan ready for review',
        type: 'success'
      });
      
    } catch (error) {
      addMessage(`❌ Failed to generate orchestration plan: ${error instanceof Error ? error.message : 'Unknown error'}`, 'agent');
      addToast({
        message: 'Plan generation failed',
        type: 'error'
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecutePlan = async (plan: ClaudePlan) => {
    addMessage(`🚀 Executing orchestration plan with ${plan.actions.length} actions...`, 'agent');
    
    try {
      claudeAutoExecutor.updateSettings({
        enableAutoExecution: true,
        maxActionsPerRun: plan.actions.length,
        requireConfirmation: false,
        safeMode: true
      });
      
      const result = await claudeAutoExecutor.executeOrchestrationPlan(plan);
      
      addMessage(
        `✅ **Orchestration Completed**\n\n${result}\n\nCheck the logs and file changes for details.`,
        'agent'
      );
      
      addToast({
        message: 'Orchestration plan executed successfully',
        type: 'success'
      });
      
    } catch (error) {
      addMessage(`❌ Orchestration execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'agent');
      addToast({
        message: 'Orchestration execution failed',
        type: 'error'
      });
    }
  };

  /* TEMPORARILY DISABLED - File actions functionality
  const handleFileAction = async (action: any) => {
    try {
      switch (action.action) {
        case 'create_file':
        case 'update_file':
          // Get existing content if file exists
          const existingFile = openTabs.find(tab => tab.path === action.path);
          const oldContent = existingFile?.content || '';
          
          // Check if there are actual differences
          if (!hasDifferences(oldContent, action.content)) {
            addMessage(
              `ℹ️ No changes needed for \`${action.path}\` - file is already up to date.`, 
              'agent'
            );
            break;
          }

          // Handle self-critique mode
          if (enableSelfCritique && chatOptions.enableActions) {
            try {
              addMessage(
                `🔍 Self-critique mode enabled. Reviewing and improving \`${action.path}\` before applying changes...`, 
                'agent'
              );

              const critiqueResult = await writeAgentFileWithCritique(
                action.path,
                action.content,
                action.language,
                'claude-chat',
                true
              );

              if (critiqueResult) {
                const statusEmoji = {
                  'approved': '✅',
                  'needs_improvement': '🛠️',
                  'rejected': '❌'
                }[critiqueResult.status];

                addMessage(
                  `${statusEmoji} Self-critique complete for \`${action.path}\`:\n\n**Status:** ${critiqueResult.status.toUpperCase()}\n**Confidence:** ${Math.round(critiqueResult.confidence * 100)}%\n\n**Analysis:** ${critiqueResult.explanation}\n\n${critiqueResult.suggestions.length > 0 ? `**Suggestions:**\n${critiqueResult.suggestions.map(s => `• ${s}`).join('\n')}` : ''}`, 
                  'agent'
                );

                if (critiqueResult.status === 'rejected') {
                  addToast({
                    message: `Code for ${action.path} was rejected and auto-fixed`,
                    type: 'warning'
                  });
                } else if (critiqueResult.status === 'needs_improvement') {
                  addToast({
                    message: `Code for ${action.path} was improved`,
                    type: 'info'
                  });
                } else {
                  addToast({
                    message: `Code for ${action.path} approved by self-critique`,
                    type: 'success'
                  });
                }

                // Add critique result to memory
                addMemory(
                  `Claude self-critique for ${action.path}: ${critiqueResult.status.toUpperCase()} - ${critiqueResult.explanation.substring(0, 150)}...`,
                  'self_critique',
                  {
                    filePath: action.path,
                    critiqueStatus: critiqueResult.status,
                    confidence: critiqueResult.confidence,
                    improvedCode: !!critiqueResult.improvedContent,
                    importance: critiqueResult.status === 'rejected' ? 'high' : 'medium',
                    tags: ['self-critique', 'code-review', critiqueResult.status]
                  }
                );
              } else {
                addMessage(
                  `ℹ️ File \`${action.path}\` was created without self-critique (critique system unavailable).`, 
                  'agent'
                );
              }

              break; // Exit early for self-critique mode - file is already written
            } catch (critiqueError) {
              addMessage(
                `⚠️ Self-critique failed for \`${action.path}\`. Falling back to standard review process.\n\nError: ${critiqueError instanceof Error ? critiqueError.message : 'Unknown error'}`, 
                'agent'
              );
              // Continue with normal diff process
            }
          }
          
          // Standard diff process (when self-critique is disabled or failed)
          const diffId = addPendingDiff({
            path: action.path,
            oldContent,
            newContent: action.content,
            reason: action.reason || `${action.action === 'create_file' ? 'Create new file' : 'Update file'} as requested`
          });
          
          // Send file action message to bus
          sendMessage(MessagePatterns.fileUpdate(
            AGENT_TYPES.CLAUDE,
            action.path,
            `${action.action === 'create_file' ? 'Creating' : 'Updating'} file: ${action.reason || 'File modification requested'}`
          ));
          
          // Add to memory
          addMemory(
            `Claude suggested ${action.action === 'create_file' ? 'creating' : 'updating'} file: ${action.path}. ${action.reason || 'No specific reason provided.'}`,
            'file_action',
            {
              filePath: action.path,
              actionType: action.action,
              importance: 'high',
              tags: ['file-action', action.action, 'pending-review']
            }
          );
          
          // Open diff modal immediately
          openDiffModal(diffId);
          
          addMessage(
            `📋 ${action.action === 'create_file' ? 'File creation' : 'File changes'} ready for review: \`${action.path}\`${action.reason ? `\n\n${action.reason}` : ''}\n\nCheck the **Changes** tab to approve or reject.`, 
            'agent'
          );
          
          addToast({
            message: `Review changes for ${action.path}`,
            type: 'info'
          });
          break;
          
        case 'delete_file':
          // For now, we'll just show a message since deletion is more complex
          addMessage(
            `⚠️ File deletion requested for \`${action.path}\`${action.reason ? `\n\n${action.reason}` : ''}\n\nPlease delete this file manually from the editor.`, 
            'agent'
          );
          
          addToast({
            message: `Delete ${action.path} manually`,
            type: 'warning'
          });
          break;
          
        default:
          addMessage(`❌ Unknown action: ${action.action}`, 'agent');
      }
    } catch (error) {
      addMessage(
        `❌ Failed to prepare file action: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        'agent'
      );
      
      addToast({
        message: 'File action preparation failed',
        type: 'error'
      });
    }
  };
  */ // END OF TEMPORARILY DISABLED FILE ACTIONS

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const toggleOption = (key: keyof ClaudeChatOptions) => {
    setChatOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🤖</div>
            <div>
              <h3 className="text-lg font-semibold">Claude Assistant</h3>
              <p className="text-sm text-gray-400">
                AI-powered chat with project context
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePlan}
              disabled={isPlanning}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
              title="Generate Orchestration Plan"
            >
              {isPlanning ? '⏳' : '🎯'} Plan
            </button>
            <button
              onClick={() => setShowOrchestration(!showOrchestration)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showOrchestration ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Toggle Orchestration Panel"
            >
              🚀 Orchestration
            </button>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Chat Options"
            >
              ⚙️ Options
            </button>
            <button
              onClick={clearChat}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
              title="Clear Chat"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Options Panel */}
        {showOptions && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <h4 className="text-sm font-medium mb-3">Context Options</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatOptions.includeMemory}
                  onChange={() => toggleOption('includeMemory')}
                  className="rounded"
                />
                <span>Include Agent Memory</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatOptions.includeFiles}
                  onChange={() => toggleOption('includeFiles')}
                  className="rounded"
                />
                <span>Include Current Files</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatOptions.includeProjectState}
                  onChange={() => toggleOption('includeProjectState')}
                  className="rounded"
                />
                <span>Include Project Status</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatOptions.includeTaskMemory}
                  onChange={() => toggleOption('includeTaskMemory')}
                  className="rounded"
                />
                <span>Include Task History</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatOptions.enableActions}
                  onChange={() => toggleOption('enableActions')}
                  className="rounded"
                />
                <span className="font-medium text-blue-300">🛠️ Enable File Actions</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSelfCritique}
                  onChange={(e) => setEnableSelfCritique(e.target.checked)}
                  className="rounded"
                  disabled={!chatOptions.enableActions}
                />
                <span className={`font-medium ${chatOptions.enableActions ? 'text-purple-300' : 'text-gray-500'}`}>
                  🔍 Self-Critique Mode
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Orchestration Panel */}
        {showOrchestration && (
          <div className="mt-4">
            <OrchestrationPanel 
              currentPlan={currentPlan || undefined}
              onExecutePlan={handleExecutePlan}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium mb-2">Welcome to Claude Chat!</p>
            <p className="text-sm">
              Ask me anything about your project, files, or development tasks.
              I have access to your project context and agent memory.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                <div className={`text-xs mt-2 opacity-70 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isAgentTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-3 max-w-[80%]">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm">Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Claude about your project, files, or development tasks..."
            disabled={isAgentTyping}
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAgentTyping}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {isAgentTyping ? '⏳' : '📤'}
          </button>
        </div>
        
        {/* Context Indicators */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
          <span className={`flex items-center gap-1 ${chatOptions.includeMemory ? 'text-green-400' : 'text-gray-500'}`}>
            🧠 Memory: {chatOptions.includeMemory ? 'ON' : 'OFF'}
          </span>
          <span className={`flex items-center gap-1 ${chatOptions.includeFiles ? 'text-green-400' : 'text-gray-500'}`}>
            📁 Files: {chatOptions.includeFiles ? 'ON' : 'OFF'}
          </span>
          <span className={`flex items-center gap-1 ${chatOptions.includeProjectState ? 'text-green-400' : 'text-gray-500'}`}>
            🏗️ Project: {chatOptions.includeProjectState ? 'ON' : 'OFF'}
          </span>
          <span className={`flex items-center gap-1 ${chatOptions.includeTaskMemory ? 'text-green-400' : 'text-gray-500'}`}>
            🧠 Tasks: {chatOptions.includeTaskMemory ? 'ON' : 'OFF'}
          </span>
          <span className={`flex items-center gap-1 font-medium ${chatOptions.enableActions ? 'text-blue-400' : 'text-gray-500'}`}>
            🛠️ Actions: {chatOptions.enableActions ? 'ON' : 'OFF'}
          </span>
          {chatOptions.enableActions && (
            <span className={`flex items-center gap-1 font-medium ${enableSelfCritique ? 'text-purple-400' : 'text-gray-500'}`}>
              🔍 Self-Critique: {enableSelfCritique ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}