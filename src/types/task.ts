import type { CodexProjectConfig, ProjectRecord, ProjectType } from './project';

export type TaskStatusFlag =
  | 'queued'
  | 'running'
  | 'starting'
  | 'connected'
  | 'indexing'
  | 'thinking'
  | 'doing'
  | 'building'
  | 'build_failed'
  | 'deploy_failed'
  | 'deploying'
  | 'deployed'
  | 'checking'
  | 'continuing'
  | 'queued_for_continuation'
  | 'waiting_for_reply'
  | 'replying'
  | 'waiting_for_engine'
  | 'queued_for_engine'
  | 'engine_running'
  | 'codex_active'
  | 'submitting_to_codex'
  | 'waiting_for_codex'
  | 'codex_running'
  | 'codex_completed'
  | 'codex_failed'
  | 'completed'
  | 'failed'
  | 'ready'
  | 'idle'
  | 'complete'
  | 'awaiting_review'
  | 'error'
  | 'stopped'
  | 'paused'
  | string;

export type TaskStatus = {
  flag: TaskStatusFlag;
  phase: string;
  message: string;
  updatedAt: string;
  lastError: string;
  isComplete: boolean;
  humanStopRequested: boolean;
};

export type TaskHistoryItem = {
  trace?: string;

  ts?: string;
  timestamp?: string;
  kind?: string;
  summary?: string;
  message?: string;
  whyThisHelps?: string;
  action?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progressSoFar?: string;
  thinking?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TaskLimits = {
  maxAgentLoops: number;
  maxActionsPerThink: number;
  maxBuildsPerRun: number;
  maxInstallsPerRun: number;
  maxFilesWrittenPerRun: number;
  maxFileSizeBytes: number;
  maxTotalNewDependencies: number;
};

export type TaskProject = Pick<
  ProjectRecord,
  | 'projectId'
  | 'name'
  | 'description'
  | 'projectType'
  | 'sshHost'
  | 'sshPort'
  | 'sshUser'
  | 'sshPrivateKeySecretName'
  | 'projectPath'
  | 'publicUrl'
  | 'engineInstructions'
  | 'notes'
  | 'conventions'
> & { codex?: CodexProjectConfig };

export type CodexTaskMetadata = {
  promptS3Key?: string;
  taskType?: string;
  attempts?: number;
  environmentId?: string;
  runnerJobId?: string;
  codexTaskId?: string;
  codexTaskUrl?: string;
  submissionStatus?: string;
  submittedAt?: string;
  lastCheckedAt?: string;
  completedAt?: string;
  summary?: string | null;
  error?: string;
  unknownExternalStatus?: string;
};

export type TaskInstructions = {
  goal: string;
  notes: string[];
  successCriteria: string[];
};

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'engine';
  content: string;
  createdAt: string;
  replyToMessageId?: string;
  readyForEngine?: boolean;
};

export type TaskConversation = {
  messages: ConversationMessage[];
  readyForEngine?: boolean;
  engineSummary?: string | null;
  lastMessageId?: string | null;
};

export type TaskProgress = {
  iteration: number;
  history: TaskHistoryItem[];
};



export type RunUsage = {
  loops?: number;
  actions?: number;
  builds?: number;
  installs?: number;
  filesWritten?: number;
  dependenciesAdded?: number;
  aiCalls?: number;
  aiInputTokens?: number;
  aiCachedInputTokens?: number;
  aiUncachedInputTokens?: number;
  aiOutputTokens?: number;
  aiReasoningOutputTokens?: number;
  aiTotalTokens?: number;
  fileIndexAiSummaries?: number;
  aiCacheHitRatio?: number;
};

export type EngineWorkingMemoryFile = {
  path?: string;
  reason?: string;
  status?: string;
  [key: string]: unknown;
};

export type EngineWorkingMemory = {
  taskUnderstanding?: string;
  currentApproach?: string;
  relevantFiles?: EngineWorkingMemoryFile[];
  facts?: string[];
  decisions?: string[];
  changesMade?: string[];
  blockers?: string[];
  lastBuildStatus?: string;
  lastDeployStatus?: string;
  lastCompletionOpinion?: string;
  nextSuggestedStep?: string;
  [key: string]: unknown;
};

export type ProjectIndexState = {
  bucket?: string;
  key?: string;
  generatedAt?: string;
  updatedAt?: string;
  fileCount?: number;
  status?: string;
};

export type QueueControl = {
  autoContinue: boolean;
  maxQueueRuns: number;
  queueRunsUsed: number;
  lastRunOutcome: string;
  lastRunReason: string;
};

export type TaskEngineState = {
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastRunId?: string | null;
  workingMemory?: EngineWorkingMemory;
  [key: string]: unknown;
};

export type TaskRecord = {
  taskId: string;
  projectId: string;
  title: string;
  projectType?: ProjectType;
  project: TaskProject;
  instructions: TaskInstructions;
  conversation: TaskConversation;
  status: TaskStatus;
  progress: TaskProgress;
  limits: TaskLimits;
  queueControl: QueueControl;
  engine?: TaskEngineState;
  codex?: CodexTaskMetadata;
  runUsage?: RunUsage;
  projectIndex?: ProjectIndexState;
  lastChatError?: { message?: string; at?: string };
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  taskId?: string;
  title: string;
  instructions: TaskInstructions;
  limits?: Partial<TaskLimits>;
  queueControl?: Partial<QueueControl>;
};

export type UpdateTaskInput = Partial<Omit<TaskRecord, 'taskId' | 'projectId' | 'project' | 'createdAt' | 'updatedAt' | 'limits' | 'queueControl'>> & {
  limits?: Partial<TaskLimits>;
  queueControl?: Partial<QueueControl>;
};

export type SendTaskMessageInput = {
  content: string;
  enqueue?: boolean;
};

export const READY_FOR_ENGINE_FLAGS = new Set<string>(['ready_for_engine']);

export const ENGINE_RUNNING_FLAGS = new Set<string>([
  'engine_running',
  'submitting_to_codex',
  'waiting_for_codex',
  'codex_running',
]);

export const ENGINE_RUNNING_PHASES = new Set<string>([
  'queued_for_engine',
  'starting',
  'connected',
  'indexing',
  'planning',
  'discovering',
  'plan_ready',
  'changing',
  'changes_ready_for_build',
  'thinking',
  'doing',
  'building',
  'build_passed',
  'deploying',
  'deployed',
  'checking',
  'continuing',
  'build_failed',
  'deploy_failed',
  'debug',
  'debug_thinking',
  'debug_doing',
  'debug_building',
  'debug_failed',
]);

export const QUEUED_FOR_CONTINUATION_FLAGS = new Set<string>([
  'queued_for_continuation',
]);

export const TERMINAL_STATUS_FLAGS = new Set<string>([
  'complete',
  'error',
  'awaiting_review',
  'stopped',
  'completed',
  'failed',
  'codex_completed',
  'codex_failed',
]);

export const REVIEW_STATUS_FLAGS = new Set<string>([
  'awaiting_review',
]);

export const ASSISTANT_BUSY_FLAGS = new Set<string>([
  'waiting_for_reply',
  'replying',
]);

export const CODEX_ACTIVE_FLAGS = new Set<string>([
  'queued',
  'submitting_to_codex',
  'waiting_for_codex',
  'codex_running',
]);

export const CODEX_TERMINAL_FLAGS = new Set<string>([
  'codex_completed',
  'codex_failed',
  'completed',
  'failed',
]);

export const ACTIVE_STATUS_FLAGS = new Set<string>([
  'queued',
  'running',
  'starting',
  'connected',
  'indexing',
  'thinking',
  'doing',
  'building',
  'build_failed',
  'deploy_failed',
  'deploying',
  'deployed',
  'checking',
  'continuing',
  'planning',
  'discovering',
  'plan_ready',
  'changing',
  'changes_ready_for_build',
  'debug',
  'debug_thinking',
  'debug_doing',
  'debug_building',
  'waiting_for_reply',
  'replying',
  ...READY_FOR_ENGINE_FLAGS,
  ...ENGINE_RUNNING_FLAGS,
  ...CODEX_ACTIVE_FLAGS,
  ...QUEUED_FOR_CONTINUATION_FLAGS,
]);

export type FormattedProgressItem = {
  id: string;
  label: string;
  detail?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string;
};

const SENSITIVE_TEXT_PATTERN = /\b(secret|private[_ -]?key|token|password|authorization|api[_ -]?key|access[_ -]?key|session|credential)\b/i;
const MAX_PROGRESS_TEXT_LENGTH = 260;

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function safeProgressText(value: unknown, maxLength = MAX_PROGRESS_TEXT_LENGTH): string {
  const text = compactText(value)
    .split('\n')
    .map((line) => (SENSITIVE_TEXT_PATTERN.test(line) ? '[redacted sensitive output]' : line.trim()))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function valueFromRecord(record: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function resultOk(result: Record<string, unknown> | undefined): boolean | undefined {
  if (!result) {
    return undefined;
  }
  const value = valueFromRecord(result, ['ok', 'success', 'passed']);
  return typeof value === 'boolean' ? value : undefined;
}

function toneForKind(kind: string, item: TaskHistoryItem, result?: Record<string, unknown>): FormattedProgressItem['tone'] {
  const ok = resultOk(result);
  if (item.error || kind.includes('error') || kind.includes('failed') || ok === false) {
    return 'error';
  }
  if (kind.includes('complete') || kind.includes('deployed') || ok === true) {
    return 'success';
  }
  if (kind.includes('incomplete') || kind.includes('build_failed') || kind.includes('deploy_failed')) {
    return 'warning';
  }
  return 'info';
}

export type TaskUiState =
  | 'ready'
  | 'ready_for_engine'
  | 'queued_for_engine'
  | 'engine_running'
  | 'codex_active'
  | 'codex_active'
  | 'submitting_to_codex'
  | 'waiting_for_codex'
  | 'codex_running'
  | 'codex_completed'
  | 'codex_failed'
  | 'completed'
  | 'failed'
  | 'awaiting_review'
  | 'complete'
  | 'error'
  | 'stopped'
  | 'queued_for_continuation'
  | 'assistant_busy'
  | 'idle';

export function getTaskUiState(task: TaskRecord | null): TaskUiState {
  if (!task) {
    return 'idle';
  }

  const flag = task.status.flag || '';
  const phase = task.status.phase || '';

  if (flag === 'codex_completed') {
    return 'codex_completed';
  }
  if (flag === 'codex_failed') {
    return 'codex_failed';
  }
  if (flag === 'completed' || flag === 'complete' || phase === 'complete' || task.status.isComplete) {
    return 'complete';
  }
  if (flag === 'failed' || flag === 'error' || phase === 'error') {
    return 'error';
  }
  if (flag === 'stopped' || phase === 'stopped') {
    return 'stopped';
  }
  if (REVIEW_STATUS_FLAGS.has(flag) || phase === 'awaiting_review') {
    return 'awaiting_review';
  }
  if (CODEX_ACTIVE_FLAGS.has(flag)) {
    return 'codex_active';
  }
  if (ENGINE_RUNNING_FLAGS.has(flag) || ENGINE_RUNNING_PHASES.has(phase)) {
    return 'engine_running';
  }
  if (QUEUED_FOR_CONTINUATION_FLAGS.has(flag) || phase === 'queued_for_continuation') {
    return 'queued_for_continuation';
  }
  if (flag === 'queued_for_engine' || phase === 'queued_for_engine') {
    return 'queued_for_engine';
  }
  if (flag === 'ready') {
    return 'ready';
  }
  if (READY_FOR_ENGINE_FLAGS.has(flag)) {
    return 'ready_for_engine';
  }
  if (ASSISTANT_BUSY_FLAGS.has(flag)) {
    return 'assistant_busy';
  }

  return 'idle';
}

export function isReadyForEngine(task: TaskRecord | null): boolean {
  if (!task || getTaskUiState(task) !== 'ready_for_engine') {
    return false;
  }

  const hasGoal = Boolean(task.instructions?.goal?.trim());
  const hasSuccessCriteria = Array.isArray(task.instructions?.successCriteria) && task.instructions.successCriteria.length > 0;
  return task.conversation?.readyForEngine === true && hasGoal && hasSuccessCriteria;
}

export function isEngineRunning(task: TaskRecord | null): boolean {
  return getTaskUiState(task) === 'engine_running';
}

export function isAwaitingReview(task: TaskRecord | null): boolean {
  return getTaskUiState(task) === 'awaiting_review';
}

export function isTerminalTaskState(task: TaskRecord | null): boolean {
  const state = getTaskUiState(task);
  return state === 'complete' || state === 'error' || state === 'stopped' || state === 'codex_completed' || state === 'codex_failed';
}

export function formatProgressHistoryItem(item: TaskHistoryItem, index = 0): FormattedProgressItem | null {
  const kind = String(item.kind || '').trim();
  const result = nestedRecord(item.result);
  const action = nestedRecord(item.action);
  const thinking = nestedRecord(item.thinking);
  const actionResult = nestedRecord(item.action_result);
  const buildResult = nestedRecord(item.build_result);
  const deployResult = nestedRecord(item.deploy_result);
  const completionCheck = nestedRecord(item.completion_check);
  const runIncomplete = nestedRecord(item.run_incomplete);
  const runComplete = nestedRecord(item.run_complete);
  const effectiveResult = result || actionResult || buildResult || deployResult || completionCheck || runIncomplete || runComplete;
  const timestamp = item.ts || item.timestamp;
  const resultMessage = valueFromRecord(result, ['message', 'summary', 'status', 'detail', 'output']);
  const actionMessage = valueFromRecord(action, ['message', 'summary', 'description', 'path', 'command']);
  const thinkingMessage = valueFromRecord(thinking, ['summary', 'progressSoFar', 'message']);
  const nestedProgressMessage = valueFromRecord(actionResult, ['message', 'summary']) ||
    valueFromRecord(buildResult, ['message', 'summary', 'status']) ||
    valueFromRecord(deployResult, ['message', 'summary', 'status']) ||
    valueFromRecord(completionCheck, ['message', 'summary', 'result']) ||
    valueFromRecord(runIncomplete, ['message', 'summary']) ||
    valueFromRecord(runComplete, ['message', 'summary']);
  const primaryText = safeProgressText(
    item.summary ||
      item.progressSoFar ||
      thinkingMessage ||
      item.message ||
      nestedProgressMessage ||
      resultMessage ||
      actionMessage ||
      item.whyThisHelps ||
      item.error,
  );
  const errorText = safeProgressText(
    item.error ||
      compactText(item.trace) ||
      valueFromRecord(result, ['error', 'stderr']) ||
      valueFromRecord(actionResult, ['error', 'stderr']) ||
      valueFromRecord(buildResult, ['error', 'stderr']) ||
      valueFromRecord(deployResult, ['error', 'stderr']),
    220,
  );

  if (!kind && !primaryText && !errorText) {
    return null;
  }

  let label = kind ? humanizeToken(kind) : 'Engine update';
  let detail = primaryText;
  const tone = toneForKind(kind, item, effectiveResult);
  const ok = resultOk(effectiveResult);

  if (kind === 'thinking' || kind.includes('thinking')) {
    label = kind.includes('debug') ? 'Debug thinking' : 'Thinking';
  } else if (kind === 'action_result' || kind.includes('action_result')) {
    label = kind.includes('debug') ? 'Debug action result' : 'Action result';
  } else if (kind === 'build_result' || kind.includes('build_result') || kind.includes('build')) {
    if (kind.includes('debug')) {
      label = ok === false || item.error ? 'Debug build failed' : 'Debug build result';
    } else {
      label = ok === false || item.error ? 'Build failed' : 'Build result';
    }
  } else if (kind === 'deploy_result' || kind.includes('deploy_result') || kind.includes('deploy')) {
    label = ok === false || item.error ? 'Deploy failed' : 'Deploy result';
  } else if (kind === 'completion_check' || kind.includes('completion_check')) {
    label = 'Completion check';
  } else if (kind === 'run_incomplete' || kind.includes('run_incomplete')) {
    label = 'Run incomplete';
  } else if (kind === 'run_complete' || kind.includes('run_complete')) {
    label = 'Run complete';
  } else if (kind === 'error' || item.error) {
    label = 'Error';
  }

  if ((kind.includes('build') || kind.includes('deploy') || kind.includes('completion_check')) && ok !== undefined && detail) {
    detail = `${ok ? 'Passed' : 'Failed'} — ${detail}`;
  } else if ((kind.includes('build') || kind.includes('deploy') || kind.includes('completion_check')) && ok !== undefined) {
    detail = ok ? 'Passed.' : 'Failed.';
  }

  if (errorText && !detail.includes(errorText)) {
    detail = detail ? `${detail} ${errorText}` : errorText;
  }

  return {
    id: `${timestamp || 'progress'}-${kind || 'item'}-${index}`,
    label,
    detail: detail || undefined,
    tone,
    timestamp,
  };
}

export function getRecentEngineProgress(task: TaskRecord | null, limit = 20): FormattedProgressItem[] {
  const history = task?.progress?.history || [];
  return history
    .map((item, index) => formatProgressHistoryItem(item, index))
    .filter((item): item is FormattedProgressItem => Boolean(item))
    .slice(-limit);
}


export type DerivedTaskUiState = {
  label: string;
  detail: string;
  canPromote: boolean;
  canChat: boolean;
  engineWorking: boolean;
};

export function deriveTaskUiState(task: TaskRecord | null): DerivedTaskUiState {
  const phaseLabelMap: Record<string, string> = {
    queued_for_engine: 'Queued for engine',
    starting: 'Starting engine run',
    connected: 'Connected to execution host',
    indexing: 'Indexing project files',
    planning: 'Planning changes',
    discovering: 'Planning changes',
    plan_ready: 'Plan ready',
    changing: 'Applying planned changes',
    changes_ready_for_build: 'Ready to build',
    thinking: 'Planning implementation',
    doing: 'Applying implementation actions',
    continuing: 'Preparing continuation run',
    building: 'Running build',
    build_failed: 'Build failed (recovering)',
    build_passed: 'Build passed',
    deploying: 'Deploying changes',
    deploy_failed: 'Deploy failed (recovering)',
    deployed: 'Deploy completed',
    checking: 'Checking completion criteria',
    awaiting_review: 'Awaiting human review',
    complete: 'Task complete',
    error: 'Engine error',
    codex_queued: 'Queued for Codex Cloud',
    codex_submitting: 'Submitting to Codex Cloud',
    codex_waiting: 'Waiting for Codex Cloud updates',
    codex_running: 'Codex Cloud running',
    debug: 'Debugging build failure',
    debug_thinking: 'Debugging build failure',
    debug_doing: 'Applying debug fixes',
    debug_building: 'Rebuilding after debug fixes',
    debug_failed: 'Debug recovery exhausted',
  };
  if (!task) {
    return { label: 'Task status unknown', detail: 'No status available.', canPromote: false, canChat: true, engineWorking: false };
  }

  const flag = task.status?.flag || '';
  const phase = task.status?.phase || 'unknown';
  const canPromote = isReadyForEngine(task);

  switch (flag) {
    case 'ready_for_engine':
      return { label: 'Ready to promote to engine', detail: task.status.message || 'Task is prepared and ready to promote to the engine.', canPromote, canChat: true, engineWorking: false };
    case 'queued_for_engine':
      return { label: 'Queued for engine', detail: task.status.message || 'Waiting for engine worker to start.', canPromote: false, canChat: false, engineWorking: false };
    case 'queued':
    case 'submitting_to_codex':
    case 'waiting_for_codex':
    case 'codex_running':
      return { label: phaseLabelMap[phase] || 'Codex Cloud active', detail: task.status.message || 'Waiting for Codex Cloud task updates.', canPromote: false, canChat: false, engineWorking: true };
    case 'codex_completed':
      return { label: 'Codex Cloud completed', detail: task.status.message || 'Codex Cloud completed the task. Review the result before taking further action.', canPromote: false, canChat: true, engineWorking: false };
    case 'codex_failed':
      return { label: 'Codex Cloud failed', detail: task.codex?.error || task.status.message || task.status.lastError || 'Codex Cloud task failed.', canPromote: false, canChat: true, engineWorking: false };
    case 'engine_running': {
      const phaseLabel = phaseLabelMap[phase] || `Engine status: ${phase}`;
      const stopRequested = task.status.humanStopRequested ? ' Stop requested; waiting for a safe stop.' : '';
      return { label: phaseLabel, detail: `${task.status.message || phaseLabel}.${stopRequested}`.trim(), canPromote: false, canChat: false, engineWorking: true };
    }
    case 'queued_for_continuation':
      return { label: 'Queued for continuation', detail: task.status.message || 'Waiting for next continuation run.', canPromote: false, canChat: false, engineWorking: true };
    case 'ready':
      return { label: 'Assistant replied', detail: task.status.message || 'Assistant replied. More clarification needed.', canPromote: false, canChat: true, engineWorking: false };
    case 'awaiting_review': {
      const needsManualResume = task.queueControl && task.queueControl.autoContinue === false
        ? ' Auto-continue is off; requeue or resume manually when ready.'
        : '';
      return { label: 'Review required', detail: `${task.status.message || 'Engine run paused safely and needs review.'}${needsManualResume}`, canPromote: false, canChat: true, engineWorking: false };
    }
    case 'complete':
      return { label: 'Complete', detail: task.status.message || 'Task complete.', canPromote: false, canChat: true, engineWorking: false };
    case 'error':
      return { label: 'Error', detail: task.status.message || task.status.lastError || 'Task failed.', canPromote: false, canChat: true, engineWorking: false };
    default: {
      const fallbackLabel = `Engine status: ${phase}`;
      return { label: fallbackLabel, detail: task.status?.message || fallbackLabel, canPromote: false, canChat: true, engineWorking: false };
    }
  }
}

export function isTaskActive(task: TaskRecord | null): boolean {
  if (!task || isTerminalTaskState(task) || isAwaitingReview(task)) {
    return false;
  }

  const state = getTaskUiState(task);
  return (
    state === 'ready_for_engine' ||
    state === 'ready' ||
    state === 'queued_for_engine' ||
    state === 'codex_active' ||
    state === 'engine_running' ||
    state === 'queued_for_continuation' ||
    state === 'assistant_busy' ||
    ACTIVE_STATUS_FLAGS.has(task.status.flag)
  );
}

export const DEFAULT_LIMITS: TaskLimits = {
  maxAgentLoops: 20,
  maxActionsPerThink: 6,
  maxBuildsPerRun: 20,
  maxInstallsPerRun: 2,
  maxFilesWrittenPerRun: 20,
  maxFileSizeBytes: 120000,
  maxTotalNewDependencies: 4,
};
