'use client';

import { useState, useRef, useEffect } from 'react';

interface LogEntry {
  type: 'status' | 'tool_call' | 'tool_result' | 'done' | 'error';
  message?: string;
  tool?: string;
  args?: Record<string, unknown>;
  summary?: string;
  result?: Record<string, unknown>;
}

interface Preset {
  label: string;
  task: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Improve preview CSS',
    task: 'Inspect src/lib/preview/generatePreviewCss.ts and src/lib/preview/generatePageHtml.ts. Improve the visual polish for generated local-service website previews. Keep the owner UI no-code. Run npm run build.'
  },
  {
    label: 'Add template variant',
    task: 'Add a new premium home-services template variant. Update deterministic template/theme mapping and preview CSS if needed. Run npm run build and npm test.'
  },
  {
    label: 'Fix build error',
    task: 'Run npm run build. If it fails, inspect the errors, fix the issue, and rerun the build.'
  },
  {
    label: 'Add regression test',
    task: 'Add regression tests for draft preview chat edits and deploy workflow. Run npm test.'
  }
];

export default function DevCodingAgentPage() {
  const [task, setTask] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  };

  const runAgent = async (taskToRun: string) => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setResult(null);
    setLogs([]);

    addLog({ type: 'status', message: 'Starting coding agent...' });

    try {
      const response = await fetch('/api/dev-coding-agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskToRun }),
      });

      if (!response.ok) {
        const err = await response.json();
        addLog({ type: 'error', message: `Error: ${err.detail || response.statusText}` });
        setRunning(false);
        return;
      }

      // Use SSE streaming
      const reader = response.body?.getReader();
      if (!reader) {
        addLog({ type: 'error', message: 'No response body' });
        setRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: doneReading, value } = await reader.read();
        if (doneReading) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);
            addLog(event);

            if (event.type === 'done' && event.result) {
              setResult(event.result);
              setDone(true);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      addLog({ type: 'error', message: `Network error: ${err instanceof Error ? err.message : 'Unknown'}` });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task.trim()) {
      runAgent(task);
    }
  };

  const handlePreset = (preset: Preset) => {
    setTask(preset.task);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Warning banner */}
      <div className="bg-amber-600 text-amber-950 px-4 py-2 text-sm font-medium text-center">
        ⚠️ Developer-only. This agent can modify local source code. Do not share with business owners.
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200 mb-4 inline-block">
          ← Back to Site Agent
        </a>
        <h1 className="text-2xl font-bold mb-2">Coding Agent</h1>
        <p className="text-gray-400 text-sm mb-6">
          ADK-style coding agent using MiniMax proxy. Searches codebase, edits files, runs build/tests.
        </p>

        {/* Task input */}
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe the task... e.g. &quot;Improve the preview CSS to look more premium for home services websites&quot;"
            className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            disabled={running}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  disabled={running}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-300 disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!task.trim() || running}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run Agent'}
            </button>
          </div>
        </form>

        {/* Logs panel */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Agent Logs</span>
            {running && (
              <div className="flex items-center gap-2 text-xs text-indigo-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                Running...
              </div>
            )}
          </div>

          <div className="h-96 overflow-y-auto p-4 font-mono text-xs space-y-1">
            {logs.length === 0 && (
              <div className="text-gray-500 text-center py-8">
                No logs yet. Run a task to see agent activity.
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-600 shrink-0">{(i + 1).toString().padStart(3, ' ')}</span>
                {log.type === 'status' && (
                  <span className="text-blue-400">{log.message}</span>
                )}
                {log.type === 'tool_call' && (
                  <span className="text-green-400">
                    → {log.tool}
                    {log.args && Object.keys(log.args).length > 0 && (
                      <span className="text-gray-500"> {JSON.stringify(log.args).slice(0, 60)}</span>
                    )}
                  </span>
                )}
                {log.type === 'tool_result' && (
                  <span className={`${log.summary === 'true' ? 'text-green-500' : 'text-yellow-500'}`}>
                    ← {log.tool} → {log.summary}
                  </span>
                )}
                {log.type === 'done' && (
                  <span className="text-purple-400">DONE</span>
                )}
                {log.type === 'error' && (
                  <span className="text-red-400">ERROR: {log.message}</span>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Result summary */}
        {done && result && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Summary</h3>
              <p className="text-sm text-gray-400">{result.summary as string}</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Changed Files</h3>
              {Array.isArray(result.changedFiles) && result.changedFiles.length > 0 ? (
                <ul className="text-xs text-gray-400 space-y-1">
                  {(result.changedFiles as string[]).map((f: string) => (
                    <li key={f} className="font-mono">{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No files changed</p>
              )}
            </div>
            {typeof result.validation === 'object' && result.validation !== null && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 col-span-2">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Validation</h3>
                <pre className="text-xs text-gray-400 overflow-auto">
                  {JSON.stringify(result.validation, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}