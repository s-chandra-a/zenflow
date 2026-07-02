export interface Task {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  priority: 'low' | 'medium' | 'high';
  period: 'today' | 'tomorrow' | 'yesterday';
  category: string;
  timeOfDay: string; // e.g., "10:00 AM", "Afternoon"
  completed: boolean;
  scheduledTime?: string; // ISO date string or HH:MM format
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  tips: string[];
}

export interface Roadblock {
  obstacle: string;
  solution: string;
}

export interface TaskWorkflow {
  taskId: string;
  steps: WorkflowStep[];
  roadblocks: Roadblock[];
  focusTips: string[];
  playlistMood: string;
}

export interface InAppNotification {
  id: string;
  taskId?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  read: boolean;
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  time: string; // HH:MM format
  duration: number; // in minutes
  category: string;
  enabled: boolean;
}
