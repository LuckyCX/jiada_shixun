import type { Dayjs } from 'dayjs';
import type { PersonalClassTask, TaskPriority } from '../../../../lib/personalClassTaskApi';

export type Task = PersonalClassTask;

export type TaskFormValues = {
  title: string;
  description: string;
  module: string;
  priority: TaskPriority;
  deadline: Dayjs | string;
  attachmentsEnabled: boolean;
  resourceLinkEnabled: boolean;
  resourceNodeIds: string[];
  scope: 'all' | 'specific';
  teamIds: string[];
};
