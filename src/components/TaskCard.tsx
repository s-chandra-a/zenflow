import React from "react";
import { Task } from "../types";
import { Check, Calendar, Clock, ChevronLeft, ChevronRight, Play, Edit3, Trash2 } from "lucide-react";

interface TaskCardProps {
  key?: any;
  task: Task;
  onToggleComplete: (id: string) => void;
  onSelectWorkflow: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onMigrateTask: (id: string, direction: "back" | "forth") => void;
  isHighlighted?: boolean;
}

export default function TaskCard({
  task,
  onToggleComplete,
  onSelectWorkflow,
  onDeleteTask,
  onEditTask,
  onMigrateTask,
  isHighlighted,
}: TaskCardProps) {
  return (
    <div
      className={`group relative p-4 rounded-xl border transition-all duration-300 ${
        isHighlighted
          ? "ring-2 ring-sage-500/50 shadow-md border-sage-400 scale-[1.01] bg-white dark:bg-nature-900"
          : task.completed
          ? "bg-nature-50/60 dark:bg-nature-950/40 border-nature-200 dark:border-nature-850 opacity-60"
          : task.priority === "high"
          ? "bg-white dark:bg-nature-900 border-rose-200 dark:border-rose-950 hover:border-rose-300 dark:hover:border-rose-900 shadow-xs"
          : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-700 hover:shadow-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
      }`}
      id={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Checkbox and Text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              task.completed
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "border-nature-300 dark:border-nature-700 hover:border-sage-500 dark:hover:border-sage-400 text-transparent hover:text-sage-500/30"
            }`}
            id={`checkbox-${task.id}`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          <div className="flex-1 min-w-0">
            <h4
              className={`text-sm font-bold leading-relaxed truncate ${
                task.completed ? "line-through text-nature-400 dark:text-nature-500" : "text-nature-950 dark:text-white"
              }`}
            >
              {task.title}
            </h4>
            {task.description && (
              <p className="text-xs text-nature-550 dark:text-nature-400 mt-1 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Badges / Stats row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="flex items-center gap-1 text-[11px] font-mono font-medium text-nature-500 dark:text-nature-400">
                <Clock className="w-3 h-3 text-sage-500" />
                {task.duration}m
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md font-bold ${
                  task.priority === "high"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40"
                    : task.priority === "medium"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40"
                    : "bg-nature-100 dark:bg-nature-800 text-nature-600 dark:text-nature-300 border border-nature-200 dark:border-nature-700"
                }`}
              >
                {task.priority}
              </span>
              <span className="text-[10px] text-nature-450 dark:text-nature-400 font-mono capitalize">
                {task.category}
              </span>
              {task.timeOfDay && (
                <span className="text-[10px] text-nature-500 dark:text-nature-300 bg-nature-100 dark:bg-nature-800 px-1.5 py-0.5 rounded-md font-mono">
                  {task.timeOfDay}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover Controls */}
        <div className="flex items-center gap-1.5 shrink-0 opacity-85 group-hover:opacity-100 transition-opacity">
          {task.period !== "yesterday" && (
            <button
              onClick={() => onMigrateTask(task.id, "back")}
              className="p-1.5 rounded-lg text-nature-400 hover:text-nature-700 dark:hover:text-nature-200 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors cursor-pointer"
              title={`Move to ${task.period === 'tomorrow' ? 'Today' : 'Yesterday'}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEditTask(task)}
            className="p-1.5 rounded-lg text-nature-400 hover:text-nature-700 dark:hover:text-nature-200 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors cursor-pointer"
            title="Edit task"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteTask(task.id)}
            className="p-1.5 rounded-lg text-nature-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {task.period !== "tomorrow" && (
            <button
              onClick={() => onMigrateTask(task.id, "forth")}
              className="p-1.5 rounded-lg text-nature-400 hover:text-nature-700 dark:hover:text-nature-200 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors cursor-pointer"
              title={`Move to ${task.period === 'yesterday' ? 'Today' : 'Tomorrow'}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {!task.completed && (
            <button
              onClick={() => onSelectWorkflow(task)}
              className="p-1.5 rounded-lg bg-sage-50 dark:bg-sage-950/45 hover:bg-sage-100 dark:hover:bg-sage-900 border border-sage-200 dark:border-sage-800 hover:border-sage-300 dark:hover:border-sage-700 text-sage-700 dark:text-sage-300 hover:text-sage-800 transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
              title="Start guided workflow"
            >
              <span>Focus</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
