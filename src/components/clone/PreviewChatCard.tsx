'use client';

import { useState } from 'react';

interface Props {
  jobId: string;
  previewUrl: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function PreviewChatCard({ jobId, previewUrl }: Props) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const userMsg = message.trim();
    setMessage('');
    setSending(true);
    setError(null);
    setSuccess(false);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await fetch(`/api/projects/clone/jobs/${jobId}/preview-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Preview updated! Your changes are now live.',
        }]);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error || 'Could not update preview'}`,
        }]);
        setError(data.error || 'Failed to update preview');
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error. Please try again.',
      }]);
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50">
        <h2 className="font-medium text-indigo-800 text-sm">Chat to edit preview</h2>
        <p className="text-xs text-indigo-600 mt-0.5">Ask for changes before deploying</p>
      </div>
      <div className="p-4 space-y-3">
        {/* Messages */}
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 italic">
            Example: &ldquo;Make the hero more premium&rdquo;, &ldquo;Add emergency service CTA&rdquo;, &ldquo;Use warmer colors&rdquo;
          </p>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`text-xs ${msg.role === 'user' ? 'text-indigo-700' : 'text-gray-600'}`}>
              <span className="font-semibold">{msg.role === 'user' ? 'You: ' : 'Assistant: '}</span>
              {msg.content}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask for changes..."
            disabled={sending}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>

        {success && (
          <p className="text-xs text-green-600">Preview updated! Refresh the iframe above to see changes.</p>
        )}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}