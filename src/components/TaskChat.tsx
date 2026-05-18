import { useState } from 'react';
import type { SendTaskMessageInput, TaskRecord } from '../types/task';

type Props = {
  task: TaskRecord | null;
  isActive: boolean;
  onSend: (input: SendTaskMessageInput) => Promise<void>;
};

function roleClass(role: string): string {
  if (role === 'user') {
    return 'ml-auto bg-amber-500 text-slate-950';
  }
  if (role === 'engine') {
    return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-500/30';
  }
  return 'bg-slate-800 text-slate-100 ring-1 ring-inset ring-white/10';
}

export function TaskChat({ task, isActive, onSend }: Props) {
  const [content, setContent] = useState('');
  const [enqueue, setEnqueue] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || !task) {
      return;
    }
    setSending(true);
    try {
      await onSend({ content: content.trim(), enqueue });
      setContent('');
      setEnqueue(false);
    } finally {
      setSending(false);
    }
  }

  if (!task) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-16 text-center text-sm text-slate-400">Select or create a task to start a chat.</div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[620px] flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{task.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{task.status.message || task.instructions.goal}</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">{task.status.flag}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {task.conversation.messages.map((message) => (
          <div key={message.id} className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${roleClass(message.role)}`}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">{message.role} · {message.createdAt}</div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        {task.conversation.messages.length === 0 && <div className="text-sm text-slate-400">No conversation yet.</div>}
      </div>
      <form onSubmit={(event) => void handleSubmit(event)} className="border-t border-white/10 p-4">
        {isActive && <div className="mb-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">The engine is active. Chat unlocks when the task reaches a terminal or review status.</div>}
        <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-amber-500 disabled:opacity-50" placeholder="Send a message, or type /run, /queue, or /start to enqueue." value={content} onChange={(event) => setContent(event.target.value)} disabled={isActive || sending} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={enqueue} onChange={(event) => setEnqueue(event.target.checked)} disabled={isActive || sending} />
            Queue engine run with this message
          </label>
          <button type="submit" disabled={isActive || sending || !content.trim()} className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Sending…' : enqueue ? 'Send + Queue' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
