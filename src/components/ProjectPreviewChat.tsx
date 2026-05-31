'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import EditErrorTrace from '@/components/project/EditErrorTrace';
import { SelectedSectionChip } from '@/components/project/SelectedSectionChip';
import { MessageSelectedSectionBadge } from '@/components/project/MessageSelectedSectionBadge';
import type { SelectedSection } from '@/lib/preview/sectionSelectionProtocol';
import {
  selectedTargetSectionId,
  type SelectedTargetInput,
} from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { markEditorVital } from '@/lib/metrics/clientVitals';

import {
  MAX_IMAGES_PER_UPLOAD,
  type WorkspaceAssetAttachment,
} from '@/lib/project-workspace/workspaceAssetTypes';
import {
  isImagePlacementRequest,
  MISSING_IMAGE_ATTACHMENT_MESSAGE,
} from '@/lib/project-workspace/edit-shared/imagePlacementIntent';
import { LEGACY_PROJECT_UNSUPPORTED_MESSAGE } from '@/lib/project-workspace/requireGitLabProject';

export interface EditCompleteResult {
  ok: boolean;
  jobId?: string;
  previewSynced?: boolean;
  changedFiles?: string[];
}

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreviews?: string[];
  selectedTarget?: SelectedTargetInput;
  /** Assistant message for a failed edit. */
  isError?: boolean;
  /** Ask-back only — not a hard failure. */
  isClarification?: boolean;
  suggestedReplies?: string[];
  /** Copy/paste diagnostic block from the server. */
  errorTrace?: string;
  errorStage?: string;
  errorJobId?: string;
};

type ChatHistoryApiMessage = Omit<ChatMessage, 'id'> & {
  timestamp?: string | Date;
};

type ChatHistoryResponse = {
  ok: boolean;
  messages?: ChatHistoryApiMessage[];
};

function createMessageId(seed: string): string {
  return seed || crypto.randomUUID();
}

/** Assign stable ids for virtualization keys when loading persisted history. */
function hydrateHistoryMessages(raw: ChatHistoryApiMessage[]): ChatMessage[] {
  return raw.map((msg, index) => {
    const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : undefined;
    const id = createMessageId(
      timestamp != null && Number.isFinite(timestamp)
        ? `${timestamp}-${index}`
        : `history-${index}-${msg.content.slice(0, 32)}`
    );
    const { timestamp: _ts, ...rest } = msg;
    return { ...rest, id };
  });
}

interface ProjectPreviewChatProps {
  projectId: string;
  disabled?: boolean;
  previewReady?: boolean;
  /** Legacy static workspace — chat edits are blocked. */
  legacyProject?: boolean;
  selectedSection?: SelectedSection | null;
  onClearSelectedSection?: () => void;
  onHistorySectionHover?: (sectionId: string | null) => void;
  onHistorySectionClick?: (sectionId: string) => void;
  focusedHistorySectionId?: string | null;
  focusChatInputKey?: number;
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

function markStepsOnEditFailure(steps: AgentStep[]): AgentStep[] {
  let hitFailure = false;
  return steps.map((step) => {
    if (step.status === 'failed') hitFailure = true;
    if (hitFailure && step.status !== 'completed') {
      return {
        ...step,
        status: 'failed' as const,
        label: step.id === 'finish' ? 'Preview not updated' : step.label,
      };
    }
    if (step.status === 'active' || step.status === 'pending') {
      return {
        ...step,
        status: 'failed' as const,
        label: step.id === 'finish' ? 'Preview not updated' : step.label,
      };
    }
    return step;
  });
}

function getPreferredStepIndex(steps: AgentStep[]): number {
  const failedIdx = steps.findIndex((s) => s.status === 'failed');
  if (failedIdx >= 0) return failedIdx;
  const activeIdx = steps.findIndex((s) => s.status === 'active');
  if (activeIdx >= 0) return activeIdx;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]?.status === 'completed') return i;
  }
  return 0;
}

function ChevronButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
        disabled
          ? 'border-transparent text-zinc-300 cursor-not-allowed'
          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'
      )}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        {direction === 'prev' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  );
}

function selectedTargetFromSection(section: SelectedSection): SelectedTargetInput {
  return {
    kind: section.kind,
    sectionId: section.sectionId,
    analyticsId: section.analyticsId,
    sectionIndex: section.sectionIndex,
    sectionType: section.sectionType,
    sectionTitle: section.sectionTitle,
  };
}

function ChatMessageBubble({
  msg,
  sending,
  previewReady,
  onApplyPrompt,
  onHistorySectionHover,
  onHistorySectionClick,
  focusedHistorySectionId,
}: {
  msg: ChatMessage;
  sending: boolean;
  previewReady: boolean;
  onApplyPrompt: (text: string) => void;
  onHistorySectionHover?: (sectionId: string | null) => void;
  onHistorySectionClick?: (sectionId: string) => void;
  focusedHistorySectionId?: string | null;
}) {
  const historySectionId = msg.selectedTarget
    ? selectedTargetSectionId(msg.selectedTarget)
    : undefined;

  return (
    <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1',
          msg.role === 'user' ? 'items-end' : 'items-start'
        )}
      >
        {msg.role === 'user' && msg.selectedTarget ? (
          <MessageSelectedSectionBadge
            target={msg.selectedTarget}
            interactive={Boolean(
              previewReady && historySectionId && (onHistorySectionHover || onHistorySectionClick)
            )}
            active={Boolean(historySectionId && historySectionId === focusedHistorySectionId)}
            onHoverStart={() => onHistorySectionHover?.(historySectionId ?? null)}
            onHoverEnd={() => onHistorySectionHover?.(null)}
            onClick={
              historySectionId && onHistorySectionClick
                ? () => onHistorySectionClick(historySectionId)
                : undefined
            }
          />
        ) : null}
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm w-full',
            msg.role === 'user'
              ? 'bg-zinc-950 text-white'
              : msg.isClarification
                ? 'bg-sky-50 border border-sky-200 text-sky-950 shadow-sm'
                : msg.isError
                  ? 'bg-red-50 border border-red-200 text-red-900 shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm'
          )}
        >
        {msg.isClarification && (
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 mb-1">
            Quick question
          </p>
        )}
        {msg.isError && !msg.isClarification && (
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">
            Edit failed
          </p>
        )}
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.isClarification && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {msg.suggestedReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={sending || !previewReady}
                onClick={() => onApplyPrompt(reply)}
                className="text-left text-xs px-2.5 py-1.5 rounded-md border border-sky-200 bg-white text-sky-900 hover:bg-sky-100/80 transition-colors disabled:opacity-50"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        {msg.isError && msg.errorTrace && (
          <EditErrorTrace trace={msg.errorTrace} jobId={msg.errorJobId} stage={msg.errorStage} />
        )}
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
    </div>
  );
}

function AgentStepNavigator({
  steps,
  failed,
  viewIndex,
  onViewIndexChange,
}: {
  steps: AgentStep[];
  failed?: boolean;
  viewIndex: number;
  onViewIndexChange: (index: number) => void;
}) {
  const safeIndex = Math.min(Math.max(viewIndex, 0), steps.length - 1);
  const step = steps[safeIndex];
  if (!step) return null;

  return (
    <div
      className={cn(
        'mt-2 flex items-center gap-2 rounded-lg border px-2 py-1.5',
        failed ? 'border-red-200 bg-red-50/80' : 'border-zinc-200/80 bg-zinc-50/80'
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <ChevronButton
        direction="prev"
        disabled={safeIndex <= 0}
        onClick={() => onViewIndexChange(safeIndex - 1)}
        label="Previous step"
      />
      <StepIcon status={step.status} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          step.status === 'pending' && 'text-zinc-400',
          step.status === 'active' && 'font-medium text-zinc-950',
          step.status === 'completed' && 'text-zinc-600',
          step.status === 'failed' && 'text-red-600'
        )}
      >
        {step.label}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
        {safeIndex + 1}/{steps.length}
      </span>
      <ChevronButton
        direction="next"
        disabled={safeIndex >= steps.length - 1}
        onClick={() => onViewIndexChange(safeIndex + 1)}
        label="Next step"
      />
    </div>
  );
}

export function ProjectPreviewChat({
  projectId,
  disabled,
  previewReady = true,
  legacyProject = false,
  selectedSection = null,
  onClearSelectedSection,
  onHistorySectionHover,
  onHistorySectionClick,
  focusedHistorySectionId = null,
  focusChatInputKey = 0,
  onEditStart,
  onEditSuccess,
  onEditComplete,
}: ProjectPreviewChatProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const [stepViewIndex, setStepViewIndex] = useState(0);
  const manualStepNavRef = useRef(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chipAnchorRef = useRef<HTMLDivElement>(null);
  const chatInputId = `project-chat-input-${projectId}`;

  const inputDisabled = disabled || !previewReady || sending;

  useEffect(() => {
    if (focusChatInputKey <= 0) return;
    chipAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById(chatInputId)?.focus();
  }, [focusChatInputKey, chatInputId]);

  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [pendingImages]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/messages?limit=100`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to load chat history');
        const data = (await res.json()) as ChatHistoryResponse;
        if (!active) return;
        setMessages(
          hydrateHistoryMessages(Array.isArray(data.messages) ? data.messages : [])
        );
        markEditorVital('editor.chat_history_loaded', {
          projectId,
          count: Array.isArray(data.messages) ? data.messages.length : 0,
        });
      } catch (err) {
        if (!active) return;
        setMessages([]);
        if (err instanceof Error && err.name === 'AbortError') return;
        setHistoryError('Could not load chat history. Try refreshing the page.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => {
      active = false;
      controller.abort();
    };
  }, [projectId]);

  useEffect(() => {
    if (!showSteps || agentSteps.length === 0 || manualStepNavRef.current) return;
    setStepViewIndex(getPreferredStepIndex(agentSteps));
  }, [agentSteps, showSteps]);

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

    let res: Response;
    try {
      res = await fetch(`/api/projects/${projectId}/code-agent/upload-assets`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      throw new Error(
        'Could not reach the server. Make sure `npm run dev` is running at http://localhost:3000, then try again.'
      );
    }
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

    if (pendingImages.length === 0 && isImagePlacementRequest(userMsg)) {
      setUploadError(MISSING_IMAGE_ATTACHMENT_MESSAGE);
      return;
    }

    setInput('');
    setSending(true);
    setUploadError(null);
    onEditStart?.();
    const pinnedTarget = selectedSection ? selectedTargetFromSection(selectedSection) : undefined;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: userMsg,
        imagePreviews: pendingImages.map((img) => img.previewUrl),
        ...(pinnedTarget ? { selectedTarget: pinnedTarget } : {}),
      },
    ]);
    setShowSteps(true);
    manualStepNavRef.current = false;
    setStepViewIndex(0);
    setAgentSteps(getInitialSteps(userMsg));

    let jobId: string | undefined;
    let success = false;
    let finalOwnerMessage = '';
    let editFailed = false;
    let needsClarification = false;
    let suggestedReplies: string[] | undefined;
    let errorTrace = '';
    let errorStage = '';
    let previewSynced: boolean | undefined;
    let changedFilesFromEdit: string[] | undefined;
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

      const requestClientMessageId = crypto.randomUUID();

      let response: Response;
      try {
        response = await fetch(`/api/projects/${projectId}/code-agent/edit/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg,
            attachments,
            clientMessageId: requestClientMessageId,
            ...(pinnedTarget ? { selectedTarget: pinnedTarget } : {}),
          }),
          signal: AbortSignal.timeout(300000),
        });
      } catch {
        throw new Error(
          'Could not reach the server. Make sure `npm run dev` is running at http://localhost:3000, then try again.'
        );
      }

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
              needsClarification = Boolean(result.needsClarification);
              success = result.ok !== false;
              editFailed = !success && !needsClarification;
              jobId = result.jobId || event.jobId;
              const donePreviewSynced =
                typeof result.previewSynced === 'boolean' ? result.previewSynced : undefined;
              const doneChangedFiles = Array.isArray(result.changedFiles)
                ? (result.changedFiles as string[])
                : undefined;
              suggestedReplies = Array.isArray(result.suggestedReplies)
                ? (result.suggestedReplies as string[])
                : undefined;
              finalOwnerMessage =
                result.ownerMessage ||
                (success
                  ? 'Your website has been updated.'
                  : needsClarification
                    ? 'I need one more detail before I can apply that change.'
                    : "I couldn't apply that change. Please try again or rephrase your request.");
              if (!success && !needsClarification && typeof result.errorTrace === 'string') {
                errorTrace = result.errorTrace;
                errorStage = typeof result.errorStage === 'string' ? result.errorStage : '';
              }
              if (needsClarification && typeof result.errorStage === 'string') {
                errorStage = result.errorStage;
              }
              if (donePreviewSynced !== undefined) {
                previewSynced = donePreviewSynced;
              }
              if (doneChangedFiles) {
                changedFilesFromEdit = doneChangedFiles;
              }
            }
          } catch {
            /* skip malformed SSE */
          }
        }
      }

      if (!finalOwnerMessage) {
        finalOwnerMessage = success
          ? 'Your website has been updated.'
          : "I couldn't apply that change. Please try again or rephrase your request.";
      }

      if (editFailed) {
        setAgentSteps((prev) => markStepsOnEditFailure(prev));
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: finalOwnerMessage,
          isError: editFailed,
          isClarification: needsClarification,
          suggestedReplies: needsClarification ? suggestedReplies : undefined,
          errorTrace: editFailed && errorTrace ? errorTrace : undefined,
          errorStage: editFailed && errorStage ? errorStage : undefined,
          errorJobId: editFailed && jobId ? jobId : undefined,
        },
      ]);
      onEditComplete?.({
        ok: success || needsClarification,
        jobId,
        previewSynced,
        changedFiles: changedFilesFromEdit,
      });

      if (success) {
        onEditSuccess?.();
        setTimeout(() => {
          setShowSteps(false);
          setAgentSteps([]);
          manualStepNavRef.current = false;
        }, 2000);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      const clientTrace = [
        '=== Site Agent — Client-side failure ===',
        `time: ${new Date().toISOString()}`,
        `projectId: ${projectId}`,
        jobId ? `jobId: ${jobId}` : 'jobId: (not assigned)',
        '',
        '--- Error ---',
        error instanceof Error ? error.message : String(error),
        error instanceof Error && error.stack ? `\n--- Stack ---\n${error.stack}` : '',
        '=== End trace ===',
      ].join('\n');
      setAgentSteps((prev) => markStepsOnEditFailure(prev));
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          isError: true,
          errorTrace: clientTrace,
          errorStage: 'client_error',
          errorJobId: jobId,
        },
      ]);
      setUploadError(message);
      onEditComplete?.({ ok: false, jobId });
    } finally {
      setSending(false);
    }
  };

  const applyPrompt = useCallback((text: string) => {
    setInput(text);
  }, []);

  const renderMessage = useCallback(
    (index: number, msg: ChatMessage) => (
      <div className={cn('px-4', index === 0 ? 'pt-4' : '', 'pb-3')}>
        <ChatMessageBubble
          msg={msg}
          sending={sending}
          previewReady={previewReady}
          onApplyPrompt={applyPrompt}
          onHistorySectionHover={onHistorySectionHover}
          onHistorySectionClick={onHistorySectionClick}
          focusedHistorySectionId={focusedHistorySectionId}
        />
      </div>
    ),
    [
      applyPrompt,
      focusedHistorySectionId,
      onHistorySectionClick,
      onHistorySectionHover,
      previewReady,
      sending,
    ]
  );

  const stepsFailed = agentSteps.some((s) => s.status === 'failed');

  return (
    <Card className="flex flex-col h-full min-h-0 shadow-sm">
      <CardHeader>
        {showSteps && agentSteps.length > 0 ? (
          <>
            <h2
              className={cn(
                'font-semibold',
                stepsFailed ? 'text-red-800' : 'text-zinc-900'
              )}
            >
              {stepsFailed ? "Couldn't update your website" : 'Updating your website'}
            </h2>
            <AgentStepNavigator
              steps={agentSteps}
              failed={stepsFailed}
              viewIndex={stepViewIndex}
              onViewIndexChange={(index) => {
                manualStepNavRef.current = true;
                setStepViewIndex(index);
              }}
            />
          </>
        ) : (
          <>
            <h2 className="font-semibold text-zinc-900">Edit your website</h2>
            <p className="text-xs text-zinc-500">
              Describe changes or attach photos — preview updates before you publish
            </p>
          </>
        )}
      </CardHeader>

      <CardBody className="flex-1 flex flex-col min-h-0 p-0">
        <div className="flex-1 min-h-0 flex flex-col">
          {historyError && (
            <div className="px-4 pt-4">
              <Alert variant="error">{historyError}</Alert>
            </div>
          )}

          {historyLoading && !showSteps && !historyError && (
            <p className="text-sm text-zinc-500 text-center py-4 px-4">Loading chat history…</p>
          )}

          {!historyLoading && messages.length === 0 && !showSteps && (
            <div className="space-y-3 p-4 overflow-y-auto">
              {!previewReady && (
                <Alert variant="info">
                  Starting your preview… You can edit once it is ready.
                </Alert>
              )}
              {previewReady && (
                <>
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
                </>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <Virtuoso
              ref={virtuosoRef}
              className="flex-1 min-h-0"
              data={messages}
              computeItemKey={(_, msg) => msg.id}
              followOutput="smooth"
              initialTopMostItemIndex={Math.max(0, messages.length - 1)}
              increaseViewportBy={{ top: 200, bottom: 200 }}
              components={{
                Header: () =>
                  legacyProject ? (
                    <div className="px-4 pt-4">
                      <Alert variant="warning">{LEGACY_PROJECT_UNSUPPORTED_MESSAGE}</Alert>
                    </div>
                  ) : !previewReady ? (
                    <div className="px-4 pt-4">
                      <Alert variant="info">
                        Starting your preview… You can edit once it is ready.
                      </Alert>
                    </div>
                  ) : null,
                Footer: () => <div className="h-1" aria-hidden />,
              }}
              itemContent={renderMessage}
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-200/80 shrink-0 space-y-2">
          <div ref={chipAnchorRef}>
            {selectedSection && onClearSelectedSection ? (
              <>
                <SelectedSectionChip
                  selection={selectedSection}
                  onClear={onClearSelectedSection}
                  pulseKey={focusChatInputKey}
                  interactive={previewReady}
                  onHoverStart={() => onHistorySectionHover?.(selectedSection.sectionId)}
                  onHoverEnd={() => onHistorySectionHover?.(null)}
                />
                <p className="text-[10px] text-zinc-500 mb-2">
                  Type your edit below — e.g. make it red
                </p>
              </>
            ) : null}
          </div>
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
              id={chatInputId}
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
