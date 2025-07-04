import { create } from 'zustand';
import { ChatMessage } from '../types';
import { processPromptWithAI, getAIResponse } from '../utils/realAgentWork';
import { hasValidApiKey } from '../utils/env';
import { callClaudeWithContext, ClaudeChatOptions, ClaudeChatMessage } from '../utils/claudeApi';

interface ChatState {
  messages: ChatMessage[];
  isAgentTyping: boolean;
  isHistoryVisible: boolean;
}

interface ChatActions {
  addMessage: (content: string, sender: 'user' | 'agent') => void;
  clearChat: () => void;
  setAgentTyping: (typing: boolean) => void;
  toggleHistory: () => void;
  simulateAgentReply: (userMessage: string) => void;
  triggerAgentWorkflow: (prompt: string) => void;
  sendClaudeMessage: (prompt: string, options?: ClaudeChatOptions) => void;
  getMessagesForContext: () => ClaudeChatMessage[];
}

// Mock initial messages
const mockMessages: ChatMessage[] = [
  {
    id: 'chat-1',
    sender: 'agent',
    content: 'Hello! I\'m NeuronForge AI. Tell me what you\'d like to build and I\'ll coordinate my agents to make it happen.',
    timestamp: Date.now() - 60000,
  },
];

// Simulated agent responses based on user input
const getAgentResponse = (userMessage: string): string => {
  const message = userMessage.toLowerCase();
  
  if (message.includes('build') || message.includes('create') || message.includes('make')) {
    if (message.includes('app') || message.includes('application')) {
      return 'Great! I\'ll help you build that app. Let me spawn the appropriate agents to handle the UI, backend, and architecture.';
    } else if (message.includes('component')) {
      return 'Perfect! I\'ll create that component for you. My UI agent will generate the React code with proper TypeScript and Tailwind styling.';
    } else {
      return 'Interesting project! Let me analyze what you need and assign the right agents to handle this task.';
    }
  } else if (message.includes('hello') || message.includes('hi')) {
    return 'Hi there! Ready to build something amazing? Just describe what you want and I\'ll coordinate my agents to make it happen.';
  } else if (message.includes('help')) {
    return 'I can help you build web applications! Try saying things like "Build a todo app" or "Create a contact form component".';
  } else {
    return 'I understand! Let me process that request and get my agents working on it right away.';
  }
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: mockMessages,
  isAgentTyping: false,
  isHistoryVisible: false,

  addMessage: (content, sender) => {
    const newMessage: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender,
      content,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    // If user message, check if it's a build request
    if (sender === 'user') {
      const isWorkflowPrompt = content.toLowerCase().includes('build') || 
                              content.toLowerCase().includes('create') || 
                              content.toLowerCase().includes('make');
      
      if (isWorkflowPrompt) {
        get().triggerAgentWorkflow(content);
      } else {
        get().simulateAgentReply(content);
      }
    }
  },

  clearChat: () => {
    set({ messages: [] });
  },

  setAgentTyping: (typing) => {
    set({ isAgentTyping: typing });
  },

  toggleHistory: () => {
    set((state) => ({ isHistoryVisible: !state.isHistoryVisible }));
  },

  simulateAgentReply: async (userMessage) => {
    const { addMessage, setAgentTyping } = get();
    
    // Show typing indicator
    setAgentTyping(true);
    
    try {
      // Use real AI if available, otherwise fallback to fake response
      let response: string;
      
      if (hasValidApiKey()) {
        response = await getAIResponse(userMessage);
      } else {
        response = getAgentResponse(userMessage);
      }
      
      setAgentTyping(false);
      addMessage(response, 'agent');
    } catch (error) {
      setAgentTyping(false);
      addMessage('Sorry, I encountered an error processing your message.', 'agent');
    }
  },

  triggerAgentWorkflow: async (prompt) => {
    const { addMessage, setAgentTyping } = get();
    
    // Show typing indicator
    setAgentTyping(true);
    
    try {
      if (hasValidApiKey()) {
        // Use real AI workflow
        setAgentTyping(false);
        addMessage('Starting AI-powered development workflow...', 'agent');
        
        // Trigger the real AI agent workflow
        await processPromptWithAI(prompt);
      } else {
        // Fallback to fake workflow with API key warning
        setAgentTyping(false);
        addMessage('⚠️ No API key detected. Using simulation mode. Set VITE_AI_API_KEY in your .env file for real AI.', 'agent');
        
        // Import fake workflow as fallback
        const { processPrompt, getAgentPlan } = await import('../utils/fakeAgentWork');
        const plan = getAgentPlan(prompt);
        addMessage(plan, 'agent');
        processPrompt(prompt);
      }
    } catch (error) {
      setAgentTyping(false);
      addMessage('Sorry, I encountered an error starting the workflow.', 'agent');
    }
  },

  sendClaudeMessage: async (prompt, options = {}) => {
    const { addMessage, setAgentTyping, getMessagesForContext } = get();
    
    // Add user message
    addMessage(prompt, 'user');
    
    // Show typing indicator
    setAgentTyping(true);
    
    try {
      // Get conversation context
      const conversationHistory = getMessagesForContext();
      
      // Call Claude with context
      const response = await callClaudeWithContext(prompt, conversationHistory, {
        includeMemory: true,
        includeFiles: true,
        includeProjectState: true,
        ...options
      });
      
      setAgentTyping(false);
      addMessage(response, 'agent');
    } catch (error) {
      setAgentTyping(false);
      addMessage(`Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'agent');
      console.error('Claude chat error:', error);
    }
  },

  getMessagesForContext: () => {
    const messages = get().messages;
    // Convert to Claude API format and limit to last 10 messages for context
    return messages.slice(-10).map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      timestamp: msg.timestamp,
      id: msg.id
    }));
  },
}));