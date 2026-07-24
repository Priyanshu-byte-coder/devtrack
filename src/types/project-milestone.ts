export interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  intervalDays?: number;
  endsAfter?: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  status: string;
  priority: string;
  dueDate?: string;
  tags: string[];
  recurrence_config?: Recurrence;
  recurrence_count?: number;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  taskIds: string[];
}
