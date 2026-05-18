import { useEffect, useRef, useState } from 'react';
import type { SendTaskMessageInput, TaskRecord } from '../types/task';

const REPLYING_FLAGS = new Set(['waiting_for_reply', 'replying']);
const ENGINE_FLAGS = new Set(['waiting_for_engine', 'queued_for_engine', 'queued', 'engine_running', 'running', 'thinking', 'doing', 'building']);

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
  if (ENGINE_FLAGS.has(flag) || ENGINE_FLAGS.has(task.status.phase)) {
    return 'Engine is running...';
  }
  return null;
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
  const engineBusy = isActive || ENGINE_FLAGS.has(statusFlag) || ENGINE_FLAGS.has(statusPhase);
  const inputDisabled = waitingForAssistant || engineBusy || sending || promoting;
  const canPromote = Boolean(task?.conversation.readyForEngine && !waitingForAssistant && !engineBusy);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [task?.taskId, task?.conversation.messages.length, task?.status.flag, task?.status.phase, task?.status.message]);

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

        {activityText && (
          <div className="max-w-[88%] rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-100 ring-1 ring-inset ring-sky-500/30">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-sky-300" aria-hidden />
              <span className="font-medium">{activityText}</span>
            </div>
            <div className="mt-1 text-sky-100/80">{task.status.phase || task.status.flag}: {task.status.message || 'Waiting for the next update.'}</div>
          </div>
        )}
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
