import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { hasValidApiKey } from '../../utils/env';

const ChatBubble: React.FC = () => {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    messages, 
    isAgentTyping, 
    isHistoryVisible, 
    addMessage, 
    toggleHistory 
  } = useChatStore();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isAgentTyping]);

  const handleSend = () => {
    if (input.trim()) {
      addMessage(input.trim(), 'user');
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      {/* Chat History - appears above the input when expanded */}
      {isHistoryVisible && (
        <div className="mb-4 w-96 max-h-64 bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-300">Chat History</span>
            <button
              onClick={toggleHistory}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          <div 
            ref={messagesRef}
            className="p-3 space-y-3 overflow-y-auto max-h-48"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  <p>{message.content}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isAgentTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Input */}
      <div className="bg-gray-800 rounded-full border border-gray-700 shadow-lg p-2 flex items-center space-x-2 min-w-96">
        {/* History Toggle Button */}
        <button
          onClick={toggleHistory}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
          title="Chat History"
        >
          💬
        </button>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => setIsExpanded(false)}
          placeholder={hasValidApiKey() ? "Tell me what you'd like to build..." : "Configure API key in .env to use AI..."}
          className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none px-2"
          disabled={isAgentTyping}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isAgentTyping}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-full transition-colors"
          title="Send message"
        >
          {isAgentTyping ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status Indicators */}
      {isExpanded && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      )}
      
      {!hasValidApiKey() && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 text-xs bg-yellow-600 text-white px-2 py-1 rounded">
          🔑 Add API key to .env for real AI
        </div>
      )}
    </div>
  );
};

export default ChatBubble;