import React, { useState, useEffect, useRef } from "react";
import { Task, Habit } from "../types";
import { Clock, Calendar, CheckCircle2, AlertCircle, Plus, ChevronRight, Lock, Unlock, Eye, Play, Repeat } from "lucide-react";
import { motion } from "motion/react";
import { safeVibrate } from "../utils/haptics";

interface CalendarAgendaProps {
  tasks: Task[];
  period: 'today' | 'tomorrow' | 'yesterday';
  onUpdateTaskTime: (id: string, time: string) => void;
  onSelectTaskWorkflow: (task: Task) => void;
  onToggleComplete: (id: string) => void;
  onToggleFreeze?: (id: string) => void;
  habits?: Habit[];
  mindHabits?: boolean;
  onHabitClick?: (habitId: string) => void;
  onViewTask?: (taskId: string) => void;
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
  onToggleFreeze,
  habits = [],
  mindHabits = false,
  onHabitClick,
  onViewTask,
}: CalendarAgendaProps) {
  const filteredTasks = tasks.filter((t) => t.period === period);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTaskClick = (taskId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('a')) {
      return;
    }
    if (window.innerWidth >= 1024) return;

    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }

    setExpandedTaskId((prev) => {
      const next = prev === taskId ? null : taskId;
      if (next) {
        expandTimeoutRef.current = setTimeout(() => {
          setExpandedTaskId(null);
        }, 10000);
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    };
  }, []);

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

  const getHabitsForBucket = (hrValue: string): Habit[] => {
    if (!mindHabits || period === 'yesterday') return [];
    
    const [hrH, hrM] = hrValue.split(":").map(Number);
    const hrMin = hrH * 60 + hrM;

    return habits.filter((h) => {
      if (!h.enabled) return false;
      const [hH, hM] = h.time.split(":").map(Number);
      const hStartMin = hH * 60 + hM;
      const hEndMin = hStartMin + h.duration;
      
      return hrMin >= hStartMin && hrMin < hEndMin;
    });
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
          const hourTasks = filteredTasks.filter((t) => getTaskTimeBucket(t) === hr.value);
          const bucketHabits = getHabitsForBucket(hr.value);

          const timeToMin = (tStr: string): number => {
            if (!tStr) return 480;
            const parts = tStr.split(":");
            if (parts.length < 2) return 480;
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
          };

          const hrMin = timeToMin(hr.value);
          const continuingTasks = filteredTasks.filter((t) => {
            if (t.completed) return false;
            const startBucketMin = timeToMin(getTaskTimeBucket(t));
            const endBucketMin = startBucketMin + t.duration;
            return startBucketMin < hrMin && endBucketMin > hrMin;
          });

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
                  {bucketHabits.map((habit) => {
                    const getHabitDay = (d: Date) => {
                      const adj = new Date(d.getTime());
                      if (adj.getHours() < 8) {
                        adj.setDate(adj.getDate() - 1);
                      }
                      return adj.toISOString().split("T")[0];
                    };
                    const habitTodayStr = getHabitDay(new Date());
                    const isCompleted = habit.lastCompletedDate === habitTodayStr;

                    return (
                      <div
                        key={`bucket-habit-${habit.id}-${hr.value}`}
                        onClick={() => onHabitClick && onHabitClick(habit.id)}
                        className={`p-3 rounded-xl border border-dashed transition-all duration-200 cursor-pointer select-none backdrop-blur-xs flex items-center justify-between gap-3 ${
                          isCompleted
                            ? "bg-emerald-50/10 dark:bg-emerald-950/5 border-emerald-300/30 text-emerald-700 dark:text-emerald-450 opacity-60"
                            : "bg-sage-50/30 dark:bg-sage-950/10 border-sage-300/40 hover:border-sage-400 dark:hover:border-sage-600 text-sage-800 dark:text-sage-300"
                        }`}
                        title="Active Habit Routine. Click to view in manager."
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 rounded-lg bg-sage-500/10 dark:bg-sage-400/10 text-sage-600 dark:text-sage-400">
                            <Repeat className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold font-sans tracking-wide">
                              {habit.title}
                            </h5>
                            <p className="text-[10px] opacity-75 mt-0.5">
                              Habit routine ({habit.duration} mins)
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sage-100/50 dark:bg-sage-900/50">
                          {habit.time}
                        </span>
                      </div>
                    );
                  })}

                  {hourTasks.length === 0 && bucketHabits.length === 0 && continuingTasks.length === 0 ? (
                    <div className="text-[11px] text-nature-400 dark:text-nature-500 italic py-1 hover:text-nature-600 dark:hover:text-nature-300 transition-colors flex items-center gap-1.5">
                      No events scheduled
                    </div>
                  ) : (
                    <>
                      {continuingTasks.map((ct) => (
                        <div
                          key={`continuing-${ct.id}-${hr.value}`}
                          onClick={() => onSelectTaskWorkflow(ct)}
                          className="py-1.5 px-3 rounded-lg bg-sage-50/10 dark:bg-sage-950/5 flex items-center justify-between text-nature-600 dark:text-nature-450 cursor-pointer select-none hover:bg-sage-50/20 dark:hover:bg-sage-950/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-sage-500 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3 text-sage-500" />
                              <span>In Progress</span>
                            </span>
                            <span className="text-xs font-semibold text-nature-800 dark:text-nature-200 truncate max-w-[200px]">
                              {ct.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-sage-500">
                            <span>Busy</span>
                            <span>↑</span>
                          </div>
                        </div>
                      ))}
                      {hourTasks.map((task) => {
                        const checkTaskOverlap = (t: Task) => {
                          if (t.completed) return false;
                          if (!t.scheduledTime) return false;
                          const [th, tm] = t.scheduledTime.split(":").map(Number);
                          const tStart = th * 60 + tm;
                          const tEnd = tStart + t.duration;

                          const otherTasks = filteredTasks.filter(o => o.id !== t.id && o.scheduledTime && !o.completed);
                          for (const other of otherTasks) {
                            const [oh, om] = other.scheduledTime!.split(":").map(Number);
                            const oStart = oh * 60 + om;
                            const oEnd = oStart + other.duration;

                            if (tStart < oEnd && tEnd > oStart) {
                              return true;
                            }
                          }

                          if (mindHabits && period !== 'yesterday' && habits) {
                            const activeHabits = habits.filter(h => h.enabled);
                            for (const h of activeHabits) {
                              const [hH, hM] = h.time.split(":").map(Number);
                              const oStart = hH * 60 + hM;
                              const oEnd = oStart + h.duration;

                              if (tStart < oEnd && tEnd > oStart) {
                                return true;
                              }
                            }
                          }
                          return false;
                        };

                      const hasOverlap = checkTaskOverlap(task);

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={(e) => handleTaskClick(task.id, e)}
                          className={`p-3.5 rounded-xl border transition-all duration-200 group/card relative cursor-pointer lg:cursor-default ${
                            task.completed
                              ? "bg-emerald-50/20 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 opacity-70"
                              : hasOverlap
                              ? "bg-rose-500/5 dark:bg-rose-950/5 border-rose-350 dark:border-rose-900 hover:border-rose-450 dark:hover:border-rose-800"
                              : task.priority === "high"
                              ? "bg-white dark:bg-nature-900 border-rose-200 dark:border-rose-950 hover:border-rose-300 dark:hover:border-rose-900"
                              : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-750 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                          }`}
                        >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <button
                              onClick={() => {
                                safeVibrate(15);
                                onToggleComplete(task.id);
                              }}
                              className={`mt-0.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                                task.completed
                                  ? "text-emerald-600 hover:text-emerald-500 dark:text-emerald-455 border border-emerald-100 dark:border-emerald-900/30"
                                  : "text-nature-400 dark:text-nature-500 hover:text-nature-600 dark:hover:text-nature-300"
                              }`}
                            >
                              <CheckCircle2 className={`w-4 h-4 ${task.completed ? "fill-emerald-400/10" : ""}`} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  onClick={() => onViewTask && onViewTask(task.id)}
                                  className="p-0.5 rounded text-nature-400 hover:text-nature-700 dark:hover:text-nature-250 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                                  title="View in Tasks List"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <h4
                                  className={`text-sm font-bold ${
                                    expandedTaskId === task.id ? "whitespace-normal break-words" : "truncate"
                                  } ${
                                    task.completed ? "line-through text-nature-400 dark:text-nature-500" : "text-nature-950 dark:text-white"
                                  }`}
                                >
                                  {task.title}
                                </h4>
                              </div>
                              {task.description && (
                                <p className={`text-xs text-nature-550 dark:text-nature-400 mt-0.5 leading-relaxed ${
                                  expandedTaskId === task.id ? "whitespace-normal break-words" : "line-clamp-1"
                                }`}>
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="flex items-center gap-1 text-[11px] font-mono text-nature-500 dark:text-nature-400">
                                  <Clock className="w-3 h-3 text-sage-500" />
                                  {task.duration}m
                                </span>
                                 {task.timeFrozen && (
                                   <span className="flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold uppercase flex items-center">
                                     <Lock className="w-2.5 h-2.5" /> Frozen
                                   </span>
                                 )}
                                 {hasOverlap && (
                                   <span className="flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold uppercase flex items-center shrink-0">
                                     <AlertCircle className="w-2.5 h-2.5 animate-pulse" /> Overlap
                                   </span>
                                 )}
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
                          <div className="flex items-center justify-between lg:justify-end lg:items-center gap-2 w-full lg:w-auto mt-3 lg:mt-0 pt-2 lg:pt-0 border-t border-nature-100/60 dark:border-nature-800/60 lg:border-t-0 opacity-90 lg:opacity-85 lg:group-hover/card:opacity-100 transition-all">
                            <div className="flex items-center gap-4 lg:gap-1.5">
                              {editingTaskId === task.id ? (
                                <select
                                  value={getTaskTimeBucket(task)}
                                  onChange={(e) => {
                                    onUpdateTaskTime(task.id, e.target.value);
                                    setEditingTaskId(null);
                                  }}
                                  className="text-[11px] font-mono bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-lg px-2.5 py-1 text-nature-800 dark:text-nature-200 focus:ring-1 focus:ring-sage-500"
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
                                <>
                                  <button
                                    onClick={() => onToggleFreeze && onToggleFreeze(task.id)}
                                    className={`p-2.5 lg:p-1.5 rounded-lg border transition-all duration-150 flex items-center justify-center cursor-pointer ${
                                      task.timeFrozen
                                        ? "bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
                                        : "bg-nature-100 dark:bg-nature-800 border-nature-200 dark:border-nature-700 text-nature-600 dark:text-nature-455 hover:bg-nature-200"
                                    }`}
                                    title={task.timeFrozen ? "Time Frozen. Click to Unfreeze." : "Freeze Time"}
                                  >
                                    {task.timeFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => setEditingTaskId(task.id)}
                                    className="text-[11px] font-mono px-3.5 py-1.5 lg:px-2.5 lg:py-1 bg-nature-100 dark:bg-nature-850 hover:bg-nature-200 dark:hover:bg-nature-700 text-nature-600 dark:text-nature-300 hover:text-nature-800 dark:hover:text-white rounded-md border border-nature-200 dark:border-nature-700 transition-colors cursor-pointer"
                                    title="Reschedule hour"
                                  >
                                    Re-time
                                  </button>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => onSelectTaskWorkflow(task)}
                              className="p-2.5 lg:px-3 lg:py-1.5 rounded-lg bg-sage-50 dark:bg-sage-950/45 hover:bg-sage-100 dark:hover:bg-sage-900 border border-sage-200 dark:border-sage-800 hover:border-sage-300 dark:hover:bg-sage-700 text-sage-700 dark:text-sage-300 hover:text-sage-800 transition-all duration-150 flex items-center justify-center cursor-pointer text-[11px] font-bold gap-1"
                              title="Start Workflow Guide"
                            >
                              <Play className="w-4 h-4" />
                              <span className="hidden lg:inline">Focus</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                      );
                    })}
                    </>
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
