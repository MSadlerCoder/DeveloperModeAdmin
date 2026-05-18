import type { ProjectRecord } from '../types/project';
import type { SendTaskMessageInput, TaskRecord } from '../types/task';
import { ProjectPreviewFrame } from './ProjectPreviewFrame';
import { TaskChat } from './TaskChat';

export function TaskPage({
  project,
  task,
  isActive,
  onSendMessage,
}: {
  project: ProjectRecord | null;
  task: TaskRecord | null;
  isActive: boolean;
  onSendMessage: (input: SendTaskMessageInput) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)]">
      <TaskChat task={task} isActive={isActive} onSend={onSendMessage} />
      <ProjectPreviewFrame project={project} />
    </div>
  );
}
