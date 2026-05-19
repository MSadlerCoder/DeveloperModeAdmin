import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormattedProgressItem, SendTaskMessageInput, TaskRecord } from '../types/task';
import { deriveTaskUiState, getRecentEngineProgress, getTaskUiState, isEngineRunning, isTerminalTaskState } from '../types/task';

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

function EngineProgressHistory({ task }: { task: TaskRecord }) {
  const recentProgress = getRecentEngineProgress(task, Number.POSITIVE_INFINITY);

  if (recentProgress.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-200/25 px-4 py-3 text-cyan-100/70">
        Waiting for the engine to write progress into task.progress.history[].
      </div>
    );
  }

  return (
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
  );
}

function EngineProgressPanel({ task, onViewHistory }: { task: TaskRecord; onViewHistory: () => void }) {
  const recentProgress = getRecentEngineProgress(task, Number.POSITIVE_INFINITY);
  const state = getTaskUiState(task);
  const engineRunning = isEngineRunning(task);
  const terminal = isTerminalTaskState(task);
  const phase = task.status.phase || task.status.flag || 'idle';
  const terminalLabel = TERMINAL_LABELS[task.status.flag];
  const statusLabel = terminalLabel || (engineRunning ? `Engine: ${humanizeStatus(phase)}` : humanizeStatus(phase));
  const terminalError = state === 'error';
  const headlineClass = terminal && terminalError ? 'text-rose-100' : terminal ? 'text-emerald-100' : 'text-sky-100';
  const showPanel = engineRunning || terminal || state === 'awaiting_review' || state === 'queued_for_continuation' || recentProgress.length > 0;

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

      <div className="mt-4">
        {recentProgress.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-cyan-50/90">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">Latest progress</div>
            <div className="mt-1 text-sm">{recentProgress[recentProgress.length - 1]?.label}</div>
            {recentProgress[recentProgress.length - 1]?.detail && (
              <div className="mt-1 text-xs text-cyan-100/75">{recentProgress[recentProgress.length - 1]?.detail}</div>
            )}
          </div>
        )}
        {engineRunning && recentProgress.length === 0 && <EngineProgressHistory task={task} />}
        <button type="button" onClick={onViewHistory} className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 underline-offset-4 transition hover:text-cyan-50 hover:underline">
          View engine history
        </button>
      </div>
    </div>
  );
}

export function TaskChat({ task, isActive: _isActive, onSend, onPromote }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const readyCardRef = useRef<HTMLDivElement | null>(null);
  const wasReadyRef = useRef(false);

  const taskUiState = getTaskUiState(task);
  const derivedState = deriveTaskUiState(task);
  const waitingForAssistant = taskUiState === 'assistant_busy';
  const engineBusy = Boolean(task && (derivedState.engineWorking || taskUiState === 'queued_for_engine'));
  const inputDisabled = !derivedState.canChat || waitingForAssistant || sending || promoting;
  const canPromote = Boolean(task && derivedState.canPromote && !waitingForAssistant && !engineBusy);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [task?.taskId, task?.conversation.messages.length, task?.progress?.history.length, task?.progress?.iteration, task?.status.flag, task?.status.phase, task?.status.message, task?.status.updatedAt]);

  useEffect(() => {
    if (canPromote && !wasReadyRef.current) {
      readyCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    wasReadyRef.current = canPromote;
  }, [canPromote]);

  useEffect(() => {
    if (!historyOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setHistoryOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [historyOpen]);

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

  const activityText = !isEngineRunning(task) && !isTerminalTaskState(task) ? derivedState.label : null;

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
            <div className="mt-1 text-sky-100/80">{derivedState.detail}</div>
          </div>
        )}

        <EngineProgressPanel task={task} onViewHistory={() => setHistoryOpen(true)} />
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="border-t border-white/10 p-4">
        <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-amber-500 disabled:opacity-50" placeholder="Ask the assistant to clarify, plan, or refine this task." value={content} onChange={(event) => setContent(event.target.value)} disabled={inputDisabled} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {waitingForAssistant ? 'Waiting for the assistant reply.' : taskUiState === 'queued_for_engine' ? 'Waiting for engine worker to start.' : engineBusy ? 'The engine is working on this task.' : taskUiState === 'awaiting_review' ? 'Review the engine output, then send a message to continue.' : 'Send a message to continue planning.'}
          </p>
          <button type="submit" disabled={inputDisabled || !content.trim()} className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>

      {historyOpen &&
        createPortal(
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/75 px-4 py-6 sm:py-8" onClick={() => setHistoryOpen(false)} role="presentation">
            <div className="flex max-h-[88vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-cyan-200/25 bg-slate-900 text-cyan-50 shadow-2xl shadow-black/50" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Engine progress history">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold">Engine progress history</h3>
                  <p className="text-xs text-cyan-100/70">Complete debug timeline from task.progress.history[]</p>
                </div>
                <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-50 transition hover:bg-white/10">
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <EngineProgressHistory task={task} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
