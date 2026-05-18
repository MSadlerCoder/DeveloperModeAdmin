import type { ProjectRecord } from './project';

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
  | 'checking'
  | 'continuing'
  | 'queued_for_continuation'
  | 'waiting_for_reply'
  | 'replying'
  | 'waiting_for_engine'
  | 'engine_running'
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
  ts?: string;
  timestamp?: string;
  kind?: string;
  summary?: string;
  message?: string;
  whyThisHelps?: string;
  action?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
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
  | 'sshHost'
  | 'sshPort'
  | 'sshUser'
  | 'projectPath'
  | 'publicUrl'
  | 'engineInstructions'
  | 'notes'
  | 'conventions'
>;

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
};

export type TaskRecord = {
  taskId: string;
  projectId: string;
  title: string;
  project: TaskProject;
  instructions: TaskInstructions;
  conversation: TaskConversation;
  status: TaskStatus;
  progress: TaskProgress;
  limits: TaskLimits;
  queueControl: QueueControl;
  engine?: TaskEngineState;
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
  'checking',
  'continuing',
  'queued_for_continuation',
  'waiting_for_reply',
  'replying',
  'waiting_for_engine',
  'engine_running',
]);

export function isTaskActive(task: TaskRecord | null): boolean {
  return Boolean(task && (ACTIVE_STATUS_FLAGS.has(task.status.flag) || ACTIVE_STATUS_FLAGS.has(task.status.phase)));
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
