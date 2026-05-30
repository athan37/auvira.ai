'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface Props {
  jobId: string;
  previewUrl: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Lightweight clone-wizard chat (non-streaming). */
export default function PreviewChatCard({ jobId }: Props) {
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
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await fetch(`/api/projects/clone/jobs/${jobId}/preview-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || 'Preview updated! Your changes are now live.',
          },
        ]);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.error || 'Could not update preview'}`,
          },
        ]);
        setError(data.error || 'Failed to update preview');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. Please try again.' },
      ]);
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <h2 className="font-semibold text-zinc-900 text-sm">Chat to edit preview</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Ask for changes before deploying</p>
      </CardHeader>
      <CardBody className="space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-400 italic">
            Example: &ldquo;Make the hero more premium&rdquo;, &ldquo;Add emergency service
            CTA&rdquo;, &ldquo;Use warmer colors&rdquo;
          </p>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-xs ${msg.role === 'user' ? 'text-zinc-900' : 'text-zinc-600'}`}
            >
              <span className="font-semibold">{msg.role === 'user' ? 'You: ' : 'Assistant: '}</span>
              {msg.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())
            }
            placeholder="Ask for changes..."
            disabled={sending}
            className="flex-1 text-sm"
          />
          <Button type="button" onClick={handleSend} disabled={sending || !message.trim()} size="sm">
            {sending ? '…' : 'Send'}
          </Button>
        </div>

        {success && (
          <p className="text-xs text-emerald-700">
            Preview updated! Refresh the iframe above to see changes.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardBody>
    </Card>
  );
}
