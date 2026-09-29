// FloodGuard AI Disaster Assistant Page
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: string;
  citations: any[];
  timestamp: string;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to the FloodGuard AI Disaster Management Assistant. I can help you with:

🌧️ **Risk Explanation** - Understand current flood risk and contributing factors
🚨 **Evacuation Guidance** - Find safe routes and shelters
📊 **Scenario Comparison** - Compare different flood scenarios
📜 **Historical Context** - Compare with past flood events
🎒 **Preparedness Tips** - Get flood preparedness recommendations
🔬 **Technical Details** - Learn about models, data sources, and methodology

**Important**: I provide information based on structured prediction results. I cannot make flood decisions directly. Always follow official evacuation orders from disaster management authorities.

How can I assist you today?`,
      contentType: 'markdown',
      citations: [],
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input,
      contentType: 'text',
      citations: [],
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.chatWithAI({
        message: userInput,
        session_id: sessionId,
        language: 'en',
        context: {}, // Could pass current risk context
      });

      const assistantMessage: Message = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        contentType: response.content_type,
        citations: response.citations,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setSuggestedActions(response.suggested_actions || []);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or rephrase your question.',
        contentType: 'text',
        citations: [],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            AI Disaster Assistant
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Session: {sessionId.slice(0, 12)}...
          </p>
        </div>
        <button className="px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          New Conversation
        </button>
      </div>

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Suggested:</span>
            {suggestedActions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedAction(action)}
                className="px-3 py-1 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block px-4 py-2 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
              }`}>
                {message.contentType === 'markdown' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className="whitespace-pre-wrap">{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                {message.citations.length > 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    📚 {message.citations.length} source{message.citations.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about flood risk, evacuation, scenarios, preparedness..."
              className="w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {input && (
              <button
                onClick={() => setInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear input"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </form>

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <span>Example queries:</span>
          <button className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200" onClick={() => handleSuggestedAction("What's the current flood risk for Kerala?")}>
            Kerala risk
          </button>
          <button className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200" onClick={() => handleSuggestedAction("Show me evacuation routes from Kochi")}>
            Kochi evacuation
          </button>
          <button className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200" onClick={() => handleSuggestedAction("Compare 2018 Kerala floods with current forecast")}>
            Compare 2018
          </button>
          <button className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200" onClick={() => handleSuggestedAction("What should be in my emergency kit?")}>
            Emergency kit
          </button>
        </div>

        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
          ⚠️ <strong>Disclaimer:</strong> This AI assistant provides information based on FloodGuard prediction results. It cannot make official flood decisions or issue evacuation orders. Always follow guidance from official disaster management authorities (NDMA, State DMAs, IMD).
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;