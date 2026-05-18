import { useEffect, useRef, useState } from 'react';
import type { FormattedProgressItem, SendTaskMessageInput, TaskRecord } from '../types/task';
import { getRecentEngineProgress, isEngineRunning, isTerminalTaskState } from '../types/task';

const REPLYING_FLAGS = new Set(['waiting_for_reply', 'replying']);
const ENGINE_FLAGS = new Set(['waiting_for_engine', 'queued_for_engine', 'queued', 'engine_running', 'running', 'thinking', 'doing', 'building']);

const TERMINAL_LABELS: Record<string, string> = {
  complete: 'Complete',
  awaiting_review: 'Awaiting review',
  error: 'Error',
  stopped: 'Stopped',
};

type Props = {
  task: TaskRecord | null;
  isActive: boolean;
  onSend: (input: SendTaskMessageInput) => Promise<void>;
  onPromote: () => Promise<void>;
};

function roleClass(role: string): string {
  if (role === 'user') {
    return 'ml-auto bg-amber-500 text-slate-950';
  }
  if (role === 'assistant') {
    return 'bg-sky-500/15 text-sky-100 ring-1 ring-inset ring-sky-500/30';
  }
  if (role === 'system') {
    return 'bg-violet-500/15 text-violet-100 ring-1 ring-inset ring-violet-500/30';
  }
  if (role === 'engine') {
    return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-500/30';
  }
  return 'bg-slate-800 text-slate-100 ring-1 ring-inset ring-white/10';
}

function statusText(task: TaskRecord): string | null {
  const flag = task.status.flag;
  if (flag === 'waiting_for_reply') {
    return 'Assistant is thinking...';
  }
  if (flag === 'replying') {
    return 'Assistant is replying...';
  }
  if (flag === 'waiting_for_engine' || flag === 'queued_for_engine' || flag === 'queued') {
    return 'Waiting for engine...';
  }
  if (isEngineRunning(task) || ENGINE_FLAGS.has(flag) || ENGINE_FLAGS.has(task.status.phase)) {
    return 'Engine is running...';
  }
  return null;
}

function humanizeStatus(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function progressToneClass(tone: FormattedProgressItem['tone']): string {
  if (tone === 'success') {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';
  }
  if (tone === 'warning') {
    return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  }
  if (tone === 'error') {
    return 'border-rose-300/30 bg-rose-300/10 text-rose-100';
  }
  return 'border-sky-300/25 bg-sky-300/10 text-sky-100';
}

function EngineProgressPanel({ task }: { task: TaskRecord }) {
  const recentProgress = getRecentEngineProgress(task, 8);
  const engineRunning = isEngineRunning(task);
  const terminal = isTerminalTaskState(task);
  const phase = task.status.phase || task.status.flag || 'idle';
  const terminalLabel = TERMINAL_LABELS[task.status.flag] || TERMINAL_LABELS[task.status.phase];
  const statusLabel = terminalLabel || (engineRunning ? `Engine: ${humanizeStatus(phase)}` : humanizeStatus(phase));
  const terminalError = task.status.flag === 'error' || task.status.phase === 'error';
  const headlineClass = terminal && terminalError ? 'text-rose-100' : terminal ? 'text-emerald-100' : 'text-sky-100';
  const showPanel = engineRunning || terminal || recentProgress.length > 0;

  if (!showPanel) {
    return null;
  }

  return (
    <div className="max-w-[94%] rounded-3xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-sm text-cyan-50 shadow-lg shadow-cyan-950/20 ring-1 ring-inset ring-cyan-300/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {engineRunning && <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-200" aria-hidden />}
          <div>
            <div className={`font-semibold ${headlineClass}`}>{statusLabel}</div>
            <div className="mt-1 text-xs text-cyan-100/70">
              task.json status · {task.status.updatedAt || task.updatedAt || 'waiting for update'}
              {task.progress?.iteration ? ` · iteration ${task.progress.iteration}` : ''}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-cyan-50">{task.status.flag}</span>
      </div>

      {(task.status.message || task.status.lastError) && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-cyan-50/90">
          {task.status.message || 'Waiting for the next engine update.'}
          {task.status.lastError && <div className="mt-2 text-rose-200">{task.status.lastError}</div>}
        </div>
      )}

      {recentProgress.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">Recent engine progress</div>
          <ol className="space-y-2">
            {recentProgress.map((item) => (
              <li key={item.id} className={`rounded-2xl border px-4 py-3 ${progressToneClass(item.tone)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.timestamp && <span className="text-[11px] opacity-65">{item.timestamp}</span>}
                </div>
                {item.detail && <div className="mt-1 text-sm leading-6 opacity-90">{item.detail}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {engineRunning && recentProgress.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-cyan-200/25 px-4 py-3 text-cyan-100/70">
          Waiting for the engine to write progress into task.progress.history[].
        </div>
      )}
    </div>
  );
}

export function TaskChat({ task, isActive, onSend, onPromote }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const readyCardRef = useRef<HTMLDivElement | null>(null);
  const wasReadyRef = useRef(false);

  const statusFlag = task?.status.flag || '';
  const statusPhase = task?.status.phase || '';
  const waitingForAssistant = REPLYING_FLAGS.has(statusFlag) || REPLYING_FLAGS.has(statusPhase);
  const engineBusy = Boolean(task && (isActive || isEngineRunning(task) || ENGINE_FLAGS.has(statusFlag) || ENGINE_FLAGS.has(statusPhase)));
  const inputDisabled = waitingForAssistant || engineBusy || sending || promoting;
  const canPromote = Boolean(task?.conversation.readyForEngine && !waitingForAssistant && !engineBusy);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [task?.taskId, task?.conversation.messages.length, task?.progress?.history.length, task?.progress?.iteration, task?.status.flag, task?.status.phase, task?.status.message, task?.status.updatedAt]);

  useEffect(() => {
    if (canPromote && !wasReadyRef.current) {
      readyCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    wasReadyRef.current = canPromote;
  }, [canPromote]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || !task) {
      return;
    }
    setSending(true);
    try {
      await onSend({ content: content.trim() });
      setContent('');
    } finally {
      setSending(false);
    }
  }

  async function handlePromote() {
    if (!task || !canPromote) {
      return;
    }
    setPromoting(true);
    try {
      await onPromote();
    } finally {
      setPromoting(false);
    }
  }

  if (!task) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-16 text-center text-sm text-slate-400">Select or create a task to start a chat.</div>
      </section>
    );
  }

  const activityText = statusText(task);

  return (
    <section className="flex min-h-[72vh] flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Chat</h2>
            <p className="mt-1 text-sm text-slate-400">Chat with the planning assistant to clarify this task before sending it to the engine.</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">{task.status.flag}</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {task.conversation.messages.map((message) => (
          <div key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${roleClass(message.role)}`}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
              {message.role} · {message.createdAt}{message.readyForEngine ? ' · ready for engine' : ''}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        {task.conversation.messages.length === 0 && <div className="text-sm text-slate-400">No conversation yet.</div>}

        {canPromote && (
          <div ref={readyCardRef} className="max-w-[88%] rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-4 text-sm text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
            <div className="flex items-center gap-2 text-emerald-100">
              <span aria-hidden>🚀</span>
              <div className="font-semibold">Ready for engine</div>
            </div>
            {task.conversation.engineSummary && <div className="mt-2 text-emerald-100/90">{task.conversation.engineSummary}</div>}
            <button type="button" onClick={() => void handlePromote()} disabled={promoting} className="mt-4 rounded-2xl bg-emerald-300 px-5 py-2.5 text-base font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
              {promoting ? 'Promoting…' : 'Start implementation'}
            </button>
          </div>
        )}

        {activityText && !isEngineRunning(task) && !isTerminalTaskState(task) && (
          <div className="max-w-[88%] rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-100 ring-1 ring-inset ring-sky-500/30">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-sky-300" aria-hidden />
              <span className="font-medium">{activityText}</span>
            </div>
            <div className="mt-1 text-sky-100/80">{task.status.phase || task.status.flag}: {task.status.message || 'Waiting for the next update.'}</div>
          </div>
        )}

        <EngineProgressPanel task={task} />
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="border-t border-white/10 p-4">
        <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-amber-500 disabled:opacity-50" placeholder="Ask the assistant to clarify, plan, or refine this task." value={content} onChange={(event) => setContent(event.target.value)} disabled={inputDisabled} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {waitingForAssistant ? 'Waiting for the assistant reply.' : engineBusy ? 'The engine is working on this task.' : 'Send a message to continue planning.'}
          </p>
          <button type="submit" disabled={inputDisabled || !content.trim()} className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
