export type TaskStatusFlag = 'running' | 'paused' | 'stopped' | 'complete' | 'idle';

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
  ts: string;
  kind: string;
  summary?: string;
  whyThisHelps?: string;
  action?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

export type TaskLimits = {
  maxStepsPerRun: number;
  maxBuildsPerRun: number;
  maxInstallsPerRun: number;
  maxFilesWrittenPerRun: number;
  maxFileSizeBytes: number;
  maxTotalNewDependencies: number;
};

export type TaskProject = {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  projectPath: string;
  publicUrl: string;
};

export type TaskInstructions = {
  goal: string;
  notes: string[];
  successCriteria: string[];
};

export type TaskProgress = {
  iteration: number;
  history: TaskHistoryItem[];
};

export type TaskRecord = {
  taskId: string;
  project: TaskProject;
  instructions: TaskInstructions;
  status: TaskStatus;
  progress: TaskProgress;
  limits: TaskLimits;
};

export type CreateTaskInput = {
  taskId: string;
  project: TaskProject;
  instructions: TaskInstructions;
  limits: TaskLimits;
};

export type UpdateTaskInput = Partial<Omit<TaskRecord, 'taskId'>> & { taskId: string };
