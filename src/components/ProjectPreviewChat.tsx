'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

import {
  MAX_IMAGES_PER_UPLOAD,
  type WorkspaceAssetAttachment,
} from '@/lib/project-workspace/workspaceAssetTypes';

export interface EditCompleteResult {
  ok: boolean;
  jobId?: string;
  /** When true, open the Changes tab (partial edits or details to review). */
  showChangesTab?: boolean;
}

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  imagePreviews?: string[];
};

interface ProjectPreviewChatProps {
  projectId: string;
  disabled?: boolean;
  previewReady?: boolean;
  onEditStart?: () => void;
  onEditSuccess?: () => void;
  onEditComplete?: (result: EditCompleteResult) => void;
}

type AgentStepStatus = 'pending' | 'active' | 'completed' | 'failed';

type AgentStep = {
  id: string;
  label: string;
  status: AgentStepStatus;
};

const SUGGESTED_PROMPTS = [
  'Change the hero headline',
  'Add an FAQ section with 3 questions',
  'Add my uploaded photo to the hero section',
];

function getInitialSteps(message: string): AgentStep[] {
  const lower = message.toLowerCase();
  let applyLabel = 'Applying your requested change';

  if (
    lower.includes('background') ||
    lower.includes('color') ||
    /\b(green|blue|red|yellow)\b/.test(lower)
  ) {
    applyLabel = 'Updating the design colors';
  } else if (lower.includes('section')) {
    applyLabel = 'Updating the page section';
  } else if (lower.includes('hero')) {
    applyLabel = 'Updating the hero section';
  } else if (lower.includes('phone') || lower.includes('contact') || lower.includes('email')) {
    applyLabel = 'Updating the contact details';
  } else if (lower.includes('text') || lower.includes('headline') || lower.includes('title')) {
    applyLabel = 'Updating the text';
  }

  return [
    { id: 'understand', label: 'Understanding your request', status: 'pending' },
    { id: 'open_draft', label: 'Opening your website draft', status: 'pending' },
    { id: 'inspect_design', label: 'Checking the current website', status: 'pending' },
    { id: 'apply_change', label: applyLabel, status: 'pending' },
    { id: 'validate', label: 'Checking the preview', status: 'pending' },
    { id: 'finish', label: 'Preview updated', status: 'pending' },
  ];
}

function ImageAttachIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5.5-5.5a1.5 1.5 0 0 0-2.12 0L3 19" />
    </svg>
  );
}

function StepIcon({ status }: { status: AgentStepStatus }) {
  if (status === 'pending') {
    return <div className="w-4 h-4 rounded-full border-2 border-zinc-300 flex-shrink-0" />;
  }
  if (status === 'active') {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-zinc-950 flex-shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-zinc-950 rounded-full animate-pulse" />
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

function AgentStepsUI({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-zinc-50 p-3" aria-live="polite">
      <div className="text-sm font-medium text-zinc-700 mb-2">Updating your website</div>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <StepIcon status={step.status} />
            <span
              className={cn(
                step.status === 'pending' && 'text-zinc-400',
                step.status === 'active' && 'text-zinc-950 font-medium',
                step.status === 'completed' && 'text-zinc-600',
                step.status === 'failed' && 'text-red-600'
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectPreviewChat({
  projectId,
  disabled,
  previewReady = true,
  onEditStart,
  onEditSuccess,
  onEditComplete,
}: ProjectPreviewChatProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputDisabled = disabled || !previewReady || sending;

  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [pendingImages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showSteps, agentSteps, pendingImages]);

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const picked = Array.from(event.target.files || []);
    event.target.value = '';

    if (picked.length === 0) return;

    const remaining = MAX_IMAGES_PER_UPLOAD - pendingImages.length;
    if (remaining <= 0) {
      setUploadError(`You can attach up to ${MAX_IMAGES_PER_UPLOAD} images.`);
      return;
    }

    const accepted = picked.slice(0, remaining);
    if (picked.length > remaining) {
      setUploadError(`Only ${remaining} more image(s) can be added.`);
    }

    setPendingImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const uploadPendingImages = async (): Promise<WorkspaceAssetAttachment[]> => {
    if (pendingImages.length === 0) return [];

    const formData = new FormData();
    for (const img of pendingImages) {
      formData.append('files', img.file);
    }

    const res = await fetch(`/api/projects/${projectId}/code-agent/upload-assets`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Image upload failed');
    }
    return data.attachments as WorkspaceAssetAttachment[];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || inputDisabled) return;

    const userMsg =
      trimmed ||
      (pendingImages.length === 1
        ? 'Add this image to my website where it fits best.'
        : 'Add these images to my website where they fit best.');

    setInput('');
    setSending(true);
    setUploadError(null);
    onEditStart?.();
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMsg,
        imagePreviews: pendingImages.map((img) => img.previewUrl),
      },
    ]);
    setShowSteps(true);
    setAgentSteps(getInitialSteps(userMsg));

    let jobId: string | undefined;
    let success = false;
    let showChangesTab = false;
    let finalOwnerMessage = '';
    let attachments: WorkspaceAssetAttachment[] = [];

    try {
      attachments = await uploadPendingImages();
      const serverPreviewUrls = attachments.map((a) => a.previewUrl);
      pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setPendingImages([]);
      if (serverPreviewUrls.length > 0) {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'user' && next[i].imagePreviews?.length) {
              next[i] = { ...next[i], imagePreviews: serverPreviewUrls };
              break;
            }
          }
          return next;
        });
      }

      const response = await fetch(`/api/projects/${projectId}/code-agent/edit/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, attachments }),
        signal: AbortSignal.timeout(300000),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'step') {
              setAgentSteps((prev) =>
                prev.map((s) =>
                  s.id === event.id
                    ? { ...s, label: event.label || s.label, status: event.status }
                    : s
                )
              );
            } else if (event.type === 'done') {
              const result = event.result || {};
              success = result.ok !== false;
              jobId = result.jobId || event.jobId;
              showChangesTab = Boolean(result.showChangesTab);
              finalOwnerMessage =
                result.ownerMessage ||
                (success
                  ? 'Your website has been updated.'
                  : "I couldn't safely apply that change. See the Changes tab for details.");
            }
          } catch {
            /* skip malformed SSE */
          }
        }
      }

      if (!finalOwnerMessage) {
        finalOwnerMessage = success
          ? 'Your website has been updated.'
          : "I couldn't safely apply that change. See the Changes tab for details.";
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: finalOwnerMessage }]);
      onEditComplete?.({ ok: success, jobId, showChangesTab });

      if (success) {
        onEditSuccess?.();
      }

      setTimeout(() => {
        setShowSteps(false);
        setAgentSteps([]);
      }, success ? 2000 : 4000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: message },
      ]);
      setUploadError(message);
      onEditComplete?.({ ok: false, jobId });
      setShowSteps(false);
      setAgentSteps([]);
    } finally {
      setSending(false);
    }
  };

  const applyPrompt = (text: string) => {
    setInput(text);
  };

  return (
    <Card className="flex flex-col h-full min-h-0 shadow-sm">
      <CardHeader>
        <h2 className="font-semibold text-zinc-900">Edit your website</h2>
        <p className="text-xs text-zinc-500">
          Describe changes or attach photos — preview updates before you publish
        </p>
      </CardHeader>

      <CardBody className="flex-1 flex flex-col min-h-0 p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!previewReady && (
            <Alert variant="info">Starting your preview… You can edit once it is ready.</Alert>
          )}

          {messages.length === 0 && !showSteps && previewReady && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500 text-center py-4">
                Try a quick change, attach photos, or describe what you want.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPrompt(p)}
                    className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSteps && agentSteps.length > 0 && <AgentStepsUI steps={agentSteps} />}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm'
                )}
              >
                {msg.content}
                {msg.imagePreviews && msg.imagePreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.imagePreviews.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover border border-white/20"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} aria-hidden />
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-200/80 shrink-0 space-y-2">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative">
                  <img
                    src={img.previewUrl}
                    alt={img.file.name}
                    className="h-16 w-16 rounded-lg object-cover border border-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePendingImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 text-white text-xs leading-none"
                    aria-label={`Remove ${img.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              multiple
              className="hidden"
              onChange={handleImagePick}
              disabled={inputDisabled}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={inputDisabled || pendingImages.length >= MAX_IMAGES_PER_UPLOAD}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              title="Attach images"
              className="shrink-0 px-2.5"
            >
              <ImageAttachIcon className="h-5 w-5" />
            </Button>
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                previewReady
                  ? 'e.g. Add this photo to the hero…'
                  : 'Waiting for preview…'
              }
              disabled={inputDisabled}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={(!input.trim() && pendingImages.length === 0) || inputDisabled}
            >
              {sending ? '…' : 'Send'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
