import React, { useState } from "react";
import { Task } from "../types";
import { Clock, Calendar, CheckCircle2, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

interface CalendarAgendaProps {
  tasks: Task[];
  period: 'today' | 'tomorrow' | 'yesterday';
  onUpdateTaskTime: (id: string, time: string) => void;
  onSelectTaskWorkflow: (task: Task) => void;
  onToggleComplete: (id: string) => void;
}

const TIME_BUCKETS = [
  { label: "8:00 AM", value: "08:00" },
  { label: "8:30 AM", value: "08:30" },
  { label: "9:00 AM", value: "09:00" },
  { label: "9:30 AM", value: "09:30" },
  { label: "10:00 AM", value: "10:00" },
  { label: "10:30 AM", value: "10:30" },
  { label: "11:00 AM", value: "11:00" },
  { label: "11:30 AM", value: "11:30" },
  { label: "12:00 PM", value: "12:00" },
  { label: "12:30 PM", value: "12:30" },
  { label: "1:00 PM", value: "13:00" },
  { label: "1:30 PM", value: "13:30" },
  { label: "2:00 PM", value: "14:00" },
  { label: "2:30 PM", value: "14:30" },
  { label: "3:00 PM", value: "15:00" },
  { label: "3:30 PM", value: "15:30" },
  { label: "4:00 PM", value: "16:00" },
  { label: "4:30 PM", value: "16:30" },
  { label: "5:00 PM", value: "17:00" },
  { label: "5:30 PM", value: "17:30" },
  { label: "6:00 PM", value: "18:00" },
  { label: "6:30 PM", value: "18:30" },
  { label: "7:00 PM", value: "19:00" },
  { label: "7:30 PM", value: "19:30" },
  { label: "8:00 PM", value: "20:00" },
  { label: "8:30 PM", value: "20:30" },
  { label: "9:00 PM", value: "21:00" },
  { label: "9:30 PM", value: "21:30" },
  { label: "10:00 PM", value: "22:00" },
  { label: "10:30 PM", value: "22:30" },
  { label: "11:00 PM", value: "23:00" },
];

export default function CalendarAgenda({
  tasks,
  period,
  onUpdateTaskTime,
  onSelectTaskWorkflow,
  onToggleComplete,
}: CalendarAgendaProps) {
  const filteredTasks = tasks.filter((t) => t.period === period);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Helper to map general periods or exact times to closest 30-minute block
  const getTaskTimeBucket = (task: Task): string => {
    let timeStr = task.scheduledTime || "";
    if (!timeStr) {
      // Map timeOfDay string to closest block
      const tod = task.timeOfDay.toLowerCase();
      if (tod.includes("morning")) return "09:00";
      if (tod.includes("noon")) return "12:00";
      if (tod.includes("afternoon")) return "14:00";
      if (tod.includes("evening")) return "18:00";
      if (tod.includes("night")) return "20:00";
      return "09:00"; // fallback
    }

    // Extract HH and MM from HH:MM format
    const hmMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (hmMatch) {
      const hh = parseInt(hmMatch[1], 10);
      const mm = parseInt(hmMatch[2], 10);
      
      if (mm < 15) {
        return `${hh.toString().padStart(2, "0")}:00`;
      } else if (mm < 45) {
        return `${hh.toString().padStart(2, "0")}:30`;
      } else {
        const nextHour = (hh + 1).toString().padStart(2, "0");
        return `${nextHour}:00`;
      }
    }

    // Check if it's an ISO or datetime string
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        const hh = date.getHours();
        const mm = date.getMinutes();
        if (mm < 15) {
          return `${hh.toString().padStart(2, "0")}:00`;
        } else if (mm < 45) {
          return `${hh.toString().padStart(2, "0")}:30`;
        } else {
          const nextHour = (hh + 1).toString().padStart(2, "0");
          return `${nextHour}:00`;
        }
      }
    } catch (e) {}

    return "09:00"; // fallback
  };

  return (
    <div className="bg-white dark:bg-nature-900 rounded-2xl border border-nature-200/85 dark:border-nature-800 p-5 shadow-xs" id="calendar-agenda-root">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-sage-600" />
          <h3 className="font-semibold text-nature-850 dark:text-nature-100 text-base capitalize">
            {period} Agenda Timeline
          </h3>
        </div>
        <span className="text-xs bg-nature-100 dark:bg-nature-800 text-nature-600 dark:text-nature-300 px-2.5 py-1 rounded-full font-mono">
          {filteredTasks.length} task{filteredTasks.length !== 1 && 's'}
        </span>
      </div>

      <div className="relative border-l border-nature-200 dark:border-nature-800 ml-4 pl-6 space-y-6">
        {TIME_BUCKETS.map((hr) => {
          // Find tasks that fall in this hour bucket
          const hourTasks = filteredTasks.filter((t) => getTaskTimeBucket(t) === hr.value);

          return (
            <div key={hr.value} className="relative group" id={`agenda-hour-${hr.value}`}>
              {/* Timeline dot */}
              <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border border-nature-300 dark:border-nature-700 bg-nature-100 dark:bg-nature-800 transition-colors group-hover:border-sage-500 dark:group-hover:border-sage-400 group-hover:bg-sage-100 dark:group-hover:bg-sage-950/45" />

              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="w-20 text-xs font-mono font-bold text-nature-500 dark:text-nature-400 group-hover:text-nature-700 dark:group-hover:text-nature-250 transition-colors pt-0.5">
                  {hr.label}
                </div>

                {/* Tasks slotted at this hour */}
                <div className="flex-1 space-y-2.5">
                  {hourTasks.length === 0 ? (
                    <div className="text-[11px] text-nature-400 dark:text-nature-500 italic py-1 hover:text-nature-600 dark:hover:text-nature-300 transition-colors flex items-center gap-1.5">
                      No events scheduled
                    </div>
                  ) : (
                    hourTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3.5 rounded-xl border transition-all duration-200 group/card relative ${
                          task.completed
                            ? "bg-emerald-50/20 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 opacity-70"
                            : task.priority === "high"
                            ? "bg-white dark:bg-nature-900 border-rose-200 dark:border-rose-950 hover:border-rose-300 dark:hover:border-rose-900"
                            : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-750 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button
                              onClick={() => onToggleComplete(task.id)}
                              className={`mt-0.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                                task.completed
                                  ? "text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                                  : "text-nature-400 dark:text-nature-500 hover:text-nature-600 dark:hover:text-nature-300"
                              }`}
                            >
                              <CheckCircle2 className={`w-4 h-4 ${task.completed ? "fill-emerald-400/10" : ""}`} />
                            </button>
                            <div>
                              <h4
                                className={`text-sm font-bold ${
                                  task.completed ? "line-through text-nature-400 dark:text-nature-500" : "text-nature-950 dark:text-white"
                                }`}
                              >
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-xs text-nature-550 dark:text-nature-400 mt-0.5 line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="flex items-center gap-1 text-[11px] font-mono text-nature-500 dark:text-nature-400">
                                  <Clock className="w-3 h-3 text-sage-500" />
                                  {task.duration}m
                                </span>
                                <span
                                  className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md font-bold ${
                                    task.priority === "high"
                                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-150 dark:border-rose-900/40"
                                      : task.priority === "medium"
                                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/40"
                                      : "bg-nature-100 dark:bg-nature-800 text-nature-600 dark:text-nature-300 border border-nature-200 dark:border-nature-700"
                                  }`}
                                >
                                  {task.priority}
                                </span>
                                <span className="text-[10px] text-nature-450 dark:text-nature-400 font-mono capitalize">
                                  {task.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Workflow Action */}
                          <div className="flex items-center gap-1">
                            {editingTaskId === task.id ? (
                              <select
                                value={getTaskTimeBucket(task)}
                                onChange={(e) => {
                                  onUpdateTaskTime(task.id, e.target.value);
                                  setEditingTaskId(null);
                                }}
                                className="text-[10px] font-mono bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded px-1.5 py-0.5 text-nature-800 dark:text-nature-200"
                                onBlur={() => setEditingTaskId(null)}
                                autoFocus
                              >
                                {TIME_BUCKETS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={() => setEditingTaskId(task.id)}
                                className="text-[10px] font-mono px-2 py-0.5 bg-nature-100 dark:bg-nature-800 hover:bg-nature-200 dark:hover:bg-nature-700 text-nature-600 dark:text-nature-300 hover:text-nature-800 dark:hover:text-white rounded-md transition-colors cursor-pointer"
                                title="Reschedule hour"
                              >
                                Re-time
                              </button>
                            )}
                            <button
                              onClick={() => onSelectTaskWorkflow(task)}
                              className="p-1 rounded-lg bg-sage-50 dark:bg-sage-950/45 hover:bg-sage-100 dark:hover:bg-sage-900 border border-sage-200 dark:border-sage-800 hover:border-sage-300 dark:hover:border-sage-700 text-sage-700 dark:text-sage-300 hover:text-sage-800 transition-all duration-150 flex items-center justify-center cursor-pointer"
                              title="Start Workflow Guide"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
