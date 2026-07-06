import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, Upload, Calendar, List, Sparkles, Plus, Clock, 
  Settings, CheckCircle, CheckCircle2, ChevronRight, Play, Loader2, AlertCircle, X,
  Trash2, Edit3, Volume2, Bell, TrendingUp, History, Sun, Moon, Mic, MicOff, Palette, Flame, Trophy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, InAppNotification, Habit } from "./types";
import TaskCard from "./components/TaskCard";
import CalendarAgenda from "./components/CalendarAgenda";
import FocusWorkflowPanel from "./components/FocusWorkflowPanel";
import NotificationCenter from "./components/NotificationCenter";

// Polished starter tasks to ensure immediate visual excellence
const INITIAL_TASKS: Task[] = [];

export default function App() {
  // Primary States
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);


  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const saved = localStorage.getItem("zen_notifications");
    if (saved) {
      try {
        const parsed: InAppNotification[] = JSON.parse(saved);
        const seen = new Set<string>();
        return parsed.filter((n) => {
          if (!n || !n.id) return false;
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        });
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [selectedWorkflowTask, setSelectedWorkflowTask] = useState<Task | null>(null);
  const [activePeriod, setActivePeriod] = useState<'today' | 'tomorrow' | 'yesterday'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'focus' | 'habits' | 'tracker'>('habits');
  const [activeMobileTab, setActiveMobileTab] = useState<'tasks' | 'focus' | 'habits' | 'input' | 'scorecard'>('tasks');

  const handleSelectWorkflowTask = (task: Task) => {
    setSelectedWorkflowTask(task);
    setRightPanelTab('focus');
    setActiveMobileTab('focus');
  };

  // Token Meter States & Quota limits
  const TOKEN_QUOTA = 10000000;
  const [tokensUsed, setTokensUsed] = useState<number>(() => {
    return parseInt(localStorage.getItem("zen_tokens_used") || "0", 10);
  });

  // AI rate limits tracking
  const [requestsLog, setRequestsLog] = useState<number[]>([]);
  const [tokensLog, setTokensLog] = useState<{ timestamp: number; tokens: number }[]>([]);
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-2.5-flash');
  const [availableModels, setAvailableModels] = useState<{ name: string; displayName: string }[]>([]);
  const [apiTier, setApiTier] = useState<'free' | 'pay-as-you-go'>('free');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showQuotaPopover, setShowQuotaPopover] = useState(false);

  const addTokens = (count: number) => {
    setTokensUsed((prev) => {
      const next = prev + count;
      localStorage.setItem("zen_tokens_used", String(next));
      return next;
    });
  };

  const recordRequest = (tokens: number = 0) => {
    const now = Date.now();
    setRequestsLog((prev) => [...prev, now]);
    if (tokens > 0) {
      setTokensLog((prev) => [...prev, { timestamp: now, tokens }]);
      addTokens(tokens);
    }
  };

  // Database status states
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; type: 'mongodb' | 'local'; uri: string } | null>(null);
  const [dbUriInput, setDbUriInput] = useState("");
  const [dbConfigError, setDbConfigError] = useState<string | null>(null);
  const [dbConfigSuccess, setDbConfigSuccess] = useState<string | null>(null);
  const [isConfiguringDb, setIsConfiguringDb] = useState(false);
  const [fallbackNotifications, setFallbackNotifications] = useState<{ id: string; type: string; title: string; message: string; timestamp: string }[]>([]);

  const addFallbackNotification = (type: string, title: string, message: string) => {
    setFallbackNotifications(prev => {
      if (prev.some(n => n.type === type && n.message === message)) return prev;
      const newNotif = {
        id: `${type}-${Date.now()}`,
        type,
        title,
        message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      return [newNotif, ...prev];
    });
  };

  // AI Scheduler settings states
  const [showSchedulerSettings, setShowSchedulerSettings] = useState(false);
  const [schedulerIncludeBreaks, setSchedulerIncludeBreaks] = useState(true);
  const [schedulerMixCategories, setSchedulerMixCategories] = useState(true);
  const [schedulerContext, setSchedulerContext] = useState("");

  // User settings and productivity stats states
  const [keepYesterdayTasks, setKeepYesterdayTasks] = useState(true);
  const [daysCount, setDaysCount] = useState(0);
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0);
  const [totalUncompletedTasks, setTotalUncompletedTasks] = useState(0);
  const [lastRolloverDate, setLastRolloverDate] = useState("");
  const [celebrationEffect, setCelebrationEffect] = useState<{ type: 'streak' | 'perfect-day'; value?: number } | null>(null);
  const [clickedStreakId, setClickedStreakId] = useState<string | null>(null);
  const [mindHabits, setMindHabits] = useState(() => localStorage.getItem("zen_mind_habits") !== "false");
  const [highlightedHabitId, setHighlightedHabitId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const checkDbStatus = async () => {
    try {
      const res = await fetch("/api/db-status");
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        setDbUriInput(data.uri || "");
        if (data.type === 'local' || !data.connected) {
          addFallbackNotification(
            'mongodb',
            'Database Local Fallback',
            'MongoDB database is offline or unconfigured. Zen Flow has fallen back to the local file database.'
          );
        }
      }
    } catch (e) {
      console.error("Failed to fetch DB status:", e);
    }
  };

  const handleUpdateDbConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfiguringDb(true);
    setDbConfigError(null);
    setDbConfigSuccess(null);
    try {
      const res = await fetch("/api/db-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: dbUriInput })
      });
      const data = await res.json();
      if (data.success) {
        setDbConfigSuccess(data.message);
        checkDbStatus();
        triggerNotification("Database Connected", data.message, "success");
      } else {
        setDbConfigError(data.message);
        triggerNotification("Database Connection Error", data.message, "alert");
      }
    } catch (err: any) {
      setDbConfigError(err.message || "Failed to save configuration");
    } finally {
      setIsConfiguringDb(false);
    }
  };

  useEffect(() => {
    async function checkApiStatus() {
      try {
        const response = await fetch("/api/genai-status");
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(data.hasApiKey);
          if (data.model) {
            setSelectedAiModel(data.model);
          }
          // Auto-heal legacy mock tokens usage state so it doesn't block the new key
          const savedTokens = parseInt(localStorage.getItem("zen_tokens_used") || "0", 10);
          if (savedTokens >= 40000) {
            localStorage.setItem("zen_tokens_used", "0");
            setTokensUsed(0);
          }
        }
      } catch (err) {
        console.error("Failed to fetch API status:", err);
      }
    }
    async function fetchAvailableModels() {
      try {
        const response = await fetch("/api/models");
        if (response.ok) {
          const data = await response.json();
          if (data.models && Array.isArray(data.models)) {
            setAvailableModels(data.models);
            // If currently selected model is not in the list, set to first available or keep fallback
            const exists = data.models.some((m: any) => m.name === selectedAiModel);
            if (!exists && data.models.length > 0) {
              setSelectedAiModel(data.models[0].name);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch available models:", err);
      }
    }
    checkApiStatus();
    fetchAvailableModels();
    checkDbStatus();
  }, []);

  const bypassAI = apiTier === 'free' && tokensUsed >= TOKEN_QUOTA;

  // Habits Manager State
  const DEFAULT_HABITS: Habit[] = [];

  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);

  // Fetch tasks and habits from the server on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch tasks
        const tasksRes = await fetch("/api/tasks");
        let serverTasks: Task[] = [];
        if (tasksRes.ok) {
          serverTasks = await tasksRes.json();
        }
        
        // Fetch habits
        const habitsRes = await fetch("/api/habits");
        let serverHabits: Habit[] = [];
        if (habitsRes.ok) {
          serverHabits = await habitsRes.json();
        }

        // If tasks are empty on the server, seed with INITIAL_TASKS
        if (!serverTasks || serverTasks.length === 0) {
          serverTasks = INITIAL_TASKS;
          await fetch("/api/tasks/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks: INITIAL_TASKS })
          });
        }

        // If habits are empty on the server, seed with default habits
        if (!serverHabits || serverHabits.length === 0) {
          serverHabits = DEFAULT_HABITS;
          await fetch("/api/habits/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ habits: DEFAULT_HABITS })
          });
        }

        // Filter out legacy dummy tasks and habits if any exist
        serverTasks = serverTasks.filter(t => !["task-1", "task-2", "task-3", "task-4"].includes(t.id));
        serverHabits = serverHabits.filter(h => !["habit-1", "habit-2", "habit-3"].includes(h.id));

        // Self-healing streak logic: reset streak to 0 if lastCompletedDate was before yesterday's Habit Day (adjusted for 8 AM reset)
        const getHabitDay = (d: Date) => {
          const adj = new Date(d.getTime());
          if (adj.getHours() < 8) {
            adj.setDate(adj.getDate() - 1);
          }
          return adj.toISOString().split("T")[0];
        };

        const now = new Date();
        const habitTodayStr = getHabitDay(now);

        const yesterday = new Date(now.getTime());
        if (yesterday.getHours() < 8) {
          yesterday.setDate(yesterday.getDate() - 1);
        }
        yesterday.setDate(yesterday.getDate() - 1);
        const habitYesterdayStr = yesterday.toISOString().split("T")[0];
        
        serverHabits = serverHabits.map((h) => {
          const currentStreak = h.streak ?? 0;
          if (!h.enabled) {
            // Paused: preserve the streak exactly
            return h;
          }
          if (h.lastCompletedDate && h.lastCompletedDate !== habitTodayStr && h.lastCompletedDate !== habitYesterdayStr) {
            return { ...h, streak: 0 };
          }
          return { ...h, streak: currentStreak };
        });

        // Fetch settings
        const settingsRes = await fetch("/api/settings");
        let serverSettings = {
          keepYesterdayTasks: true,
          daysCount: 0,
          totalCompletedTasks: 0,
          totalUncompletedTasks: 0,
          lastRolloverDate: ""
        };
        if (settingsRes.ok) {
          serverSettings = await settingsRes.json();
          setKeepYesterdayTasks(serverSettings.keepYesterdayTasks);
          setDaysCount(serverSettings.daysCount);
          setTotalCompletedTasks(serverSettings.totalCompletedTasks);
          setTotalUncompletedTasks(serverSettings.totalUncompletedTasks);
          setLastRolloverDate(serverSettings.lastRolloverDate);
        }

        const currentHabitDay = habitTodayStr;

        if (!serverSettings.lastRolloverDate) {
          // First run initialization: set last rollover date without shifting
          const initSettings = {
            ...serverSettings,
            lastRolloverDate: currentHabitDay
          };
          await fetch("/api/settings/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: initSettings })
          });
          setLastRolloverDate(currentHabitDay);
        } else if (serverSettings.lastRolloverDate !== currentHabitDay) {
          // A rollover is triggered!
          // 1. Record completed vs uncompleted for today's tasks
          const todayCompleted = serverTasks.filter(t => t.period === 'today' && t.completed).length;
          const todayUncompleted = serverTasks.filter(t => t.period === 'today' && !t.completed).length;

          // Calculate the number of days since last rollover to catch up
          const lastDate = new Date(serverSettings.lastRolloverDate + "T00:00:00");
          const currDate = new Date(currentHabitDay + "T00:00:00");
          const diffTime = currDate.getTime() - lastDate.getTime();
          const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

          const newDaysCount = serverSettings.daysCount + diffDays;
          const newTotalCompleted = serverSettings.totalCompletedTasks + todayCompleted;
          const newTotalUncompleted = serverSettings.totalUncompletedTasks + todayUncompleted;
          const newLastRolloverDate = currentHabitDay;

          setDaysCount(newDaysCount);
          setTotalCompletedTasks(newTotalCompleted);
          setTotalUncompletedTasks(newTotalUncompleted);
          setLastRolloverDate(newLastRolloverDate);

          // 2. Shift tasks:
          // If keepYesterdayTasks is false, delete existing yesterday tasks
          if (!serverSettings.keepYesterdayTasks) {
            serverTasks = serverTasks.filter(t => t.period !== 'yesterday');
          }
          // Now map and transition period:
          // - 'yesterday' -> remains 'yesterday'
          // - 'today' / 'overflow' -> 'yesterday'
          // - 'tomorrow' -> 'today'
          serverTasks = serverTasks.map(t => {
            if (t.period === 'today' || t.period === 'overflow') {
              return { ...t, period: 'yesterday' };
            } else if (t.period === 'tomorrow') {
              return { ...t, period: 'today' };
            }
            return t;
          });

          // Sync tasks and updated settings to server
          await fetch("/api/tasks/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks: serverTasks })
          });

          await fetch("/api/settings/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              settings: {
                keepYesterdayTasks: serverSettings.keepYesterdayTasks,
                daysCount: newDaysCount,
                totalCompletedTasks: newTotalCompleted,
                totalUncompletedTasks: newTotalUncompleted,
                lastRolloverDate: newLastRolloverDate
              }
            })
          });
        }

        setTasks(serverTasks);
        setHabits(serverHabits);
      } catch (e) {
        console.error("Failed to load tasks/habits from server:", e);
      } finally {
        setIsInitialLoadComplete(true);
      }
    }
    loadData();
  }, []);

  // Sync tasks to server when changed (debounced)
  useEffect(() => {
    if (!isInitialLoadComplete) return;

    const timeoutId = setTimeout(() => {
      fetch("/api/tasks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks })
      }).catch((err) => console.error("Error syncing tasks to server:", err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tasks, isInitialLoadComplete]);

  // Sync habits to server when changed (debounced)
  useEffect(() => {
    if (!isInitialLoadComplete) return;

    const timeoutId = setTimeout(() => {
      fetch("/api/habits/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habits })
      }).catch((err) => console.error("Error syncing habits to server:", err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [habits, isInitialLoadComplete]);

  // Sync settings to server when changed (debounced)
  useEffect(() => {
    if (!isInitialLoadComplete) return;

    const timeoutId = setTimeout(() => {
      fetch("/api/settings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            keepYesterdayTasks,
            daysCount,
            totalCompletedTasks,
            totalUncompletedTasks,
            lastRolloverDate
          }
        })
      }).catch((err) => console.error("Error syncing settings to server:", err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [keepYesterdayTasks, daysCount, totalCompletedTasks, totalUncompletedTasks, lastRolloverDate, isInitialLoadComplete]);

  // Auto-clear celebration confetti after 5 seconds
  useEffect(() => {
    if (celebrationEffect) {
      const timer = setTimeout(() => {
        setCelebrationEffect(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [celebrationEffect]);

  // Sync mindHabits to LocalStorage
  useEffect(() => {
    localStorage.setItem("zen_mind_habits", String(mindHabits));
  }, [mindHabits]);

  const handleResetProductivity = async () => {
    setDaysCount(0);
    setTotalCompletedTasks(0);
    setTotalUncompletedTasks(0);
    triggerNotification("Stats Reset", "Productivity stats have been reset to zero.", "info");
  };

  // Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("zen_dark_mode") === "true";
  });

  // UI Theme Option State (Forest Moss, Nordic Frost, Crimson Sand, Royal Orchid)
  const [themeOption, setThemeOption] = useState<'forest' | 'nordic' | 'crimson' | 'orchid'>(() => {
    const saved = localStorage.getItem("zen_theme_option");
    if (saved === 'forest' || saved === 'nordic' || saved === 'crimson' || saved === 'orchid') {
      return saved;
    }
    return 'forest';
  });

  useEffect(() => {
    localStorage.setItem("zen_dark_mode", String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("zen_theme_option", themeOption);
    document.documentElement.classList.remove('theme-forest', 'theme-nordic', 'theme-crimson', 'theme-orchid');
    document.documentElement.classList.add(`theme-${themeOption}`);
  }, [themeOption]);

  // Voice Dictation (Speech to Text) State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      triggerNotification(
        "Voice Dictation Unsupported",
        "Your browser does not support the Web Speech API. Try using Google Chrome, Microsoft Edge, or Safari.",
        "alert"
      );
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          triggerNotification(
            "Dictation Active",
            "Speak clearly into your microphone to dictate tasks...",
            "info"
          );
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          let errorMsg = "Microphone error or speech not recognized.";
          if (event.error === "not-allowed") {
            errorMsg = "Microphone access denied. Please allow microphone permissions.";
          } else if (event.error === "no-speech") {
            errorMsg = "No speech detected. Please speak again.";
          }
          triggerNotification("Dictation Error", errorMsg, "alert");
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          const resultsLength = event.results.length;
          const transcript = event.results[resultsLength - 1][0].transcript;
          setInputText((prev) => {
            const separator = prev.trim() ? " " : "";
            return `${prev}${separator}${transcript}`;
          });
          triggerNotification(
            "Speech Transcribed",
            "Text successfully appended to task text area.",
            "success"
          );
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error("Speech init error", err);
        setIsListening(false);
        triggerNotification("Dictation Failed", "Failed to start microphone dictation.", "alert");
      }
    }
  };

  // AI Prioritizing & Yesterday Summary States
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [yesterdaySummary, setYesterdaySummary] = useState<{
    overview: string;
    recommendations: string[];
    mantra: string;
  } | null>(() => {
    const saved = localStorage.getItem("zen_yesterday_summary");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (yesterdaySummary) {
      localStorage.setItem("zen_yesterday_summary", JSON.stringify(yesterdaySummary));
    } else {
      localStorage.removeItem("zen_yesterday_summary");
    }
  }, [yesterdaySummary]);

  // Text File Upload / Paste States
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Task Creator / Editor States
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formPeriod, setFormPeriod] = useState<'today' | 'tomorrow'>('today');
  const [formCategory, setFormCategory] = useState("work");
  const [formTimeOfDay, setFormTimeOfDay] = useState("Morning");
  const [formScheduledTime, setFormScheduledTime] = useState("");
  const [formTimeFrozen, setFormTimeFrozen] = useState(false);

  // Habit Creator / Editor States
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitFormTitle, setHabitFormTitle] = useState("");
  const [habitFormDesc, setHabitFormDesc] = useState("");
  const [habitFormTime, setHabitFormTime] = useState("08:00");
  const [habitFormDuration, setHabitFormDuration] = useState(15);
  const [habitFormCategory, setHabitFormCategory] = useState("health");
  const [habitFormEnabled, setHabitFormEnabled] = useState(true);

  const handleSaveHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitFormTitle.trim()) return;

    if (editingHabit) {
      // Edit habit
      setHabits((prev) =>
        prev.map((h) =>
          h.id === editingHabit.id
            ? {
                ...h,
                title: habitFormTitle,
                description: habitFormDesc,
                time: habitFormTime,
                duration: habitFormDuration,
                category: habitFormCategory,
                enabled: habitFormEnabled,
              }
            : h
        )
      );
      triggerNotification("Habit Modified", `Updated details for "${habitFormTitle}".`, "info");
      setEditingHabit(null);
    } else {
      // Add habit
      const newHabit: Habit = {
        id: `habit-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        title: habitFormTitle,
        description: habitFormDesc,
        time: habitFormTime,
        duration: habitFormDuration,
        category: habitFormCategory,
        enabled: habitFormEnabled,
        streak: 0,
      };
      setHabits((prev) => [newHabit, ...prev]);
      triggerNotification("Habit Created", `"${habitFormTitle}" added to habits tracker.`, "success");
      setIsAddingHabit(false);
    }

    // Reset Form
    setHabitFormTitle("");
    setHabitFormDesc("");
    setHabitFormTime("08:00");
    setHabitFormDuration(15);
    setHabitFormCategory("health");
    setHabitFormEnabled(true);
  };

  const handleStartEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitFormTitle(habit.title);
    setHabitFormDesc(habit.description);
    setHabitFormTime(habit.time);
    setHabitFormDuration(habit.duration);
    setHabitFormCategory(habit.category);
    setHabitFormEnabled(habit.enabled);
  };

  const handleDeleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    triggerNotification("Habit Deleted", "Habit successfully removed.", "warning");
    if (editingHabit?.id === id) {
      setEditingHabit(null);
    }
  };

  const handleToggleHabitEnabled = (id: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
    );
    const target = habits.find((h) => h.id === id);
    if (target) {
      triggerNotification(
        target.enabled ? "Habit Paused" : "Habit Resumed",
        `"${target.title}" is now ${target.enabled ? 'paused (streak preserved)' : 'resumed'}.`,
        "info"
      );
    }
  };

  const handleToggleHabitCompleted = (id: string) => {
    const getHabitDay = (d: Date) => {
      const adj = new Date(d.getTime());
      if (adj.getHours() < 8) {
        adj.setDate(adj.getDate() - 1);
      }
      return adj.toISOString().split("T")[0];
    };

    const now = new Date();
    const habitTodayStr = getHabitDay(now);

    const yesterday = new Date(now.getTime());
    if (yesterday.getHours() < 8) {
      yesterday.setDate(yesterday.getDate() - 1);
    }
    yesterday.setDate(yesterday.getDate() - 1);
    const habitYesterdayStr = yesterday.toISOString().split("T")[0];

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          const isCompleted = h.lastCompletedDate === habitTodayStr;
          let nextDate = "";
          let nextStreak = h.streak ?? 0;

          if (isCompleted) {
            // Unchecking
            nextDate = "";
            nextStreak = Math.max(0, nextStreak - 1);
          } else {
            // Checking
            nextDate = habitTodayStr;
            if (h.lastCompletedDate === habitYesterdayStr) {
              nextStreak = nextStreak + 1;
            } else {
              nextStreak = 1;
            }
            triggerNotification(
              "Habit Completed Today",
              `Splendid! You checked off "${h.title}" for today. Streak: ${nextStreak} days!`,
              "success"
            );
            if (nextStreak > 0 && nextStreak % 100 === 0) {
              setCelebrationEffect({ type: 'streak', value: nextStreak });
            }
          }
          return { ...h, lastCompletedDate: nextDate, streak: nextStreak };
        }
        return h;
      })
    );
  };

  const handleStreakClick = (habit: Habit) => {
    setClickedStreakId(habit.id);
    setTimeout(() => setClickedStreakId(null), 600);

    triggerNotification(
      "Streak Stats",
      `You are on an active ${habit.streak}-day streak for "${habit.title}"! 🔥`,
      "success"
    );

    // Celebrate milestone if streak is a multiple of 100
    if (habit.streak > 0 && habit.streak % 100 === 0) {
      setCelebrationEffect({ type: 'streak', value: habit.streak });
    }
  };

  const handleCalendarHabitClick = (habitId: string) => {
    setRightPanelTab('habits');
    setActiveMobileTab('habits');
    setHighlightedHabitId(habitId);
    setTimeout(() => {
      setHighlightedHabitId(null);
    }, 3000);

    setTimeout(() => {
      const cardEl = document.getElementById(`habit-card-${habitId}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const handleCalendarTaskView = (taskId: string) => {
    setIsCalendarView(false);
    setActiveMobileTab('tasks');
    setHighlightedTaskId(taskId);
    setTimeout(() => {
      setHighlightedTaskId(null);
    }, 2000);

    setTimeout(() => {
      const cardEl = document.getElementById(`task-card-${taskId}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const handleJamInToday = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          // Set to today and force timing to 22:00
          return {
            ...t,
            period: "today",
            scheduledTime: "22:00"
          };
        }
        return t;
      })
    );
    triggerNotification("Task Jammed Today", "Task successfully forced onto today's timeline at 22:00.", "success");
  };

  const handleMigrateToTomorrow = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          // Move to tomorrow and clear scheduledTime
          return {
            ...t,
            period: "tomorrow",
            scheduledTime: undefined
          };
        }
        return t;
      })
    );
    triggerNotification("Task Migrated", "Task successfully moved to tomorrow's focus list.", "info");
  };

  // Local Time State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast States
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; message: string; type: string } | null>(null);

  // Sync notifications to LocalStorage
  useEffect(() => {
    localStorage.setItem("zen_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Clock Ticker & Habits Trigger check
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // System notification trigger
  const triggerNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert') => {
    // Add to state
    const uniqueId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const newNotif: InAppNotification = {
      id: uniqueId,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Active Toast
    setActiveToast({ id: newNotif.id, title, message, type });
    setTimeout(() => {
      setActiveToast((prev) => prev?.id === newNotif.id ? null : prev);
    }, 4500);

    // Browser level
    if (!isMuted && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: message });
    }
  };

  // AI Scheduler Handler
  const handleAISchedule = async () => {
    if (tasks.length === 0) return;
    setIsPrioritizing(true);
    try {
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, "0");
      const currentMin = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHour}:${currentMin}`;

      const response = await fetch("/api/ai-scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.filter(t => t.period === activePeriod),
          habits,
          currentTime: currentTimeStr,
          period: activePeriod,
          options: {
            includeBreaks: schedulerIncludeBreaks,
            mixCategories: schedulerMixCategories,
            context: schedulerContext,
            mindHabits,
          },
          model: selectedAiModel,
          bypassAI
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule tasks");
      }

      const data = await response.json();
      
      // Update tasks state with scheduledTime, priority, and any new breaks
      if (data.scheduledTasks && Array.isArray(data.scheduledTasks)) {
        let overflowCount = 0;
        setTasks((prev) => {
          // Filter out old break tasks for this active period first to avoid duplicating breaks
          const filteredPrev = prev.filter(t => !(t.id.startsWith("task-break-") && t.period === activePeriod));

          return filteredPrev.map((t) => {
            const update = data.scheduledTasks.find((u: any) => u.id === t.id);
            if (update) {
              const updatedPeriod = update.period || t.period;
              if (updatedPeriod === "overflow") {
                overflowCount++;
              }
              return { 
                ...t, 
                priority: update.priority || t.priority,
                scheduledTime: update.scheduledTime || t.scheduledTime,
                period: updatedPeriod,
                timeFrozen: update.timeFrozen !== undefined ? update.timeFrozen : t.timeFrozen
              };
            }
            return t;
          });
        });

        if (data.isFallback) {
          addFallbackNotification(
            'gemini',
            'AI Scheduler Offline Fallback',
            'Could not reach Google AI Studio. Tasks scheduled using the local sorting algorithm.'
          );
          triggerNotification(
            "Schedule Generated (Fallback)",
            "Offline scheduler fallback has organized your tasks.",
            "warning"
          );
        } else if (overflowCount > 0) {
          triggerNotification(
            "Schedule Overflow",
            `${overflowCount} tasks did not fit today and have been moved to the Schedule Overflow Tray at the bottom.`,
            "warning"
          );
        } else {
          triggerNotification(
            "Schedule Generated",
            "Gemini has successfully organized your tasks and avoided timeline overlaps!",
            "success"
          );
        }
      }
      
      if (data.tokenUsage) {
        recordRequest(data.tokenUsage.totalTokens || 0);
      }
      setShowSchedulerSettings(false);
    } catch (err: any) {
      console.error("AI Scheduler Error:", err);
      triggerNotification("AI Scheduler Error", "We could not schedule your tasks. Please try again.", "alert");
    } finally {
      setIsPrioritizing(false);
    }
  };

  // AI Summary Generator for Yesterday's Retrospective
  const handleGenerateYesterdaySummary = async () => {
    const yesterdayTasks = tasks.filter((t) => t.period === 'yesterday');
    if (yesterdayTasks.length === 0) return;

    setIsGeneratingSummary(true);
    try {
      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: yesterdayTasks, model: selectedAiModel, bypassAI }),
      });

      if (!response.ok) {
        throw new Error("Failed to compile AI retrospective summary");
      }

      const data = await response.json();
      setYesterdaySummary(data);
      if (data.isFallback) {
        addFallbackNotification(
          'gemini',
          'Retrospective Summary Offline Fallback',
          'Could not reach Google AI Studio to generate your daily summary. Loaded offline template coaching notes.'
        );
        triggerNotification(
          "Retrospective Prepared (Fallback)",
          "Your offline coaching retrospective notes have been compiled.",
          "warning"
        );
      } else {
        triggerNotification(
          "Retrospective Prepared",
          "Your personalized AI Daily retrospective has been compiled by your coach.",
          "success"
        );
      }
      if (data.tokenUsage) {
        recordRequest(data.tokenUsage.totalTokens || 0);
      }
    } catch (err: any) {
      console.error("Summary generation error:", err);
      triggerNotification("Retrospective Failed", err.message || "Failed to generate summary.", "alert");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Seed simulated completed tasks for yesterday to let the user test previous day's summary
  const handleSeedYesterdayTasks = () => {
    const seedTasks: Task[] = [
      {
        id: `task-yesterday-1-${Date.now()}`,
        title: "Submit Q3 Product Strategy Review",
        description: "Compiled feedback from design and engineering. Submitted ahead of schedule.",
        duration: 45,
        priority: "high",
        period: "yesterday",
        category: "work",
        timeOfDay: "Morning",
        completed: true,
        scheduledTime: "10:00",
      },
      {
        id: `task-yesterday-2-${Date.now()}`,
        title: "30-Minute HIIT Cardio Run",
        description: "Outdoor run. Hit heart rate peak of 165bpm.",
        duration: 30,
        priority: "medium",
        period: "yesterday",
        category: "health",
        timeOfDay: "Afternoon",
        completed: true,
        scheduledTime: "14:00",
      },
      {
        id: `task-yesterday-3-${Date.now()}`,
        title: "Read 3 Chapters of 'Designing Calm'",
        description: "Focused study on emotional design and spatial layout.",
        duration: 40,
        priority: "low",
        period: "yesterday",
        category: "learning",
        timeOfDay: "Evening",
        completed: true,
        scheduledTime: "19:00",
      },
      {
        id: `task-yesterday-4-${Date.now()}`,
        title: "Reorganize Desk Cable Management",
        description: "Cluttered cables behind primary setup.",
        duration: 20,
        priority: "low",
        period: "yesterday",
        category: "personal",
        timeOfDay: "Evening",
        completed: false,
        scheduledTime: "20:00",
      },
    ];

    setTasks((prev) => {
      // Filter out existing yesterday tasks if any to prevent clutter
      const filtered = prev.filter((t) => t.period !== 'yesterday');
      return [...seedTasks, ...filtered];
    });

    triggerNotification(
      "Yesterday Seeded",
      "Successfully seeded yesterday's completed tasks! Check out your retrospective dashboard.",
      "success"
    );
  };

  const handleMigrateTask = (id: string, direction: 'back' | 'forth') => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          let nextPeriod: 'yesterday' | 'today' | 'tomorrow' = t.period;
          if (direction === 'back') {
            if (t.period === 'tomorrow') nextPeriod = 'today';
            else if (t.period === 'today') nextPeriod = 'yesterday';
          } else {
            if (t.period === 'yesterday') nextPeriod = 'today';
            else if (t.period === 'today') nextPeriod = 'tomorrow';
          }
          return { 
            ...t, 
            period: nextPeriod,
            scheduledTime: undefined 
          };
        }
        return t;
      })
    );

    const targetTask = tasks.find((t) => t.id === id);
    if (targetTask) {
      triggerNotification(
        "Task Rescheduled",
        `"${targetTask.title}" has been moved ${direction === 'back' ? 'backwards' : 'forwards'} in your schedule flow.`,
        "success"
      );
    }
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadedFile(e.target.files[0]);
    }
  };

  const handleUploadedFile = (file: File) => {
    if (!file.type.match("text.*") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      triggerNotification("Unsupported File Type", "Please upload a plain text (.txt) file.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setInputText(event.target.result as string);
        triggerNotification(
          "File Uploaded",
          `Successfully loaded "${file.name}". Click "Parse Tasks with AI" to generate your list.`,
          "success"
        );
      }
    };
    reader.readAsText(file);
  };

  // Call API to parse text into tasks
  const handleParseTasksWithAI = async () => {
    if (!inputText.trim()) {
      setParseError("Please paste your task list or upload a file first.");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch("/api/parse-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, model: selectedAiModel, bypassAI }),
      });

      if (!response.ok) {
        throw new Error("Gemini API was unable to interpret the schedule formatting.");
      }

      const data = await response.json();
      if (data.tasks && Array.isArray(data.tasks)) {
        const parsedTasks: Task[] = data.tasks.map((t: any, idx: number) => ({
          id: `task-parsed-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${idx}`,
          title: t.title || "Untitled Task",
          description: t.description || "",
          duration: typeof t.duration === "number" ? t.duration : 30,
          priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
          period: ["today", "tomorrow"].includes(t.period) ? t.period : "today",
          category: t.category || "other",
          timeOfDay: t.timeOfDay || "Anytime",
          completed: false,
          scheduledTime: t.scheduledTime || (t.timeOfDay === "Morning" ? "09:00" : t.timeOfDay === "Afternoon" ? "14:00" : t.timeOfDay === "Evening" ? "18:00" : "12:00"),
          timeFrozen: !!t.timeFrozen,
        }));

        // Merge or replace tasks based on choice
        setTasks((prev) => [...parsedTasks, ...prev]);
        setInputText("");
        if (data.isFallback) {
          addFallbackNotification(
            'gemini',
            'AI Task Parser Offline Fallback',
            'Could not reach Google AI Studio. Text list parsed using local pattern extraction.'
          );
          triggerNotification(
            "Tasks Parsed (Fallback)",
            `Local parser has extracted ${parsedTasks.length} tasks.`,
            "warning"
          );
        } else {
          triggerNotification(
            "Tasks Parsed",
            `Gemini successfully parsed ${parsedTasks.length} new tasks into your schedule board!`,
            "success"
          );
        }
        if (data.tokenUsage) {
          recordRequest(data.tokenUsage.totalTokens || 0);
        }
      } else {
        throw new Error("Returned format did not contain valid task structure.");
      }
    } catch (err: any) {
      console.error("Parse Error:", err);
      setParseError(err.message || "Failed to parse tasks. Check your key config or input.");
      triggerNotification("AI Parser Error", "We could not process your text list. Please try again.", "alert");
    } finally {
      setIsParsing(false);
    }
  };

  // Task Manipulation
  const handleToggleComplete = (id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const nextState = !t.completed;
          if (nextState) {
            triggerNotification("Task Completed", `Great work! "${t.title}" is complete.`, "success");
          }
          return { ...t, completed: nextState };
        }
        return t;
      });

      const targetTask = prev.find(t => t.id === id);
      if (targetTask) {
        const period = targetTask.period;
        const periodTasks = updated.filter(t => t.period === period);
        const allCompleted = periodTasks.length > 0 && periodTasks.every(t => t.completed);
        const wasNotAllCompleted = prev.filter(t => t.period === period).some(t => !t.completed);

        if (allCompleted && wasNotAllCompleted) {
          setCelebrationEffect({ type: 'perfect-day' });
        }
      }

      return updated;
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedWorkflowTask?.id === id) {
      setSelectedWorkflowTask(null);
    }
  };

  const handleUpdateTaskTime = (id: string, timeValue: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, scheduledTime: timeValue } : t))
    );
    const targetTask = tasks.find((t) => t.id === id);
    if (targetTask) {
      triggerNotification(
        "Calendar Scheduled",
        `Scheduled "${targetTask.title}" on the calendar for ${timeValue}.`,
        "info"
      );
    }
  };

  const handleToggleTaskFreeze = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextState = !t.timeFrozen;
          triggerNotification(
            nextState ? "Task Time Locked" : "Task Time Unlocked",
            `"${t.title}" is ${nextState ? "frozen at" : "released from"} ${t.scheduledTime || "12:00"}.`,
            nextState ? "warning" : "info"
          );
          return { ...t, timeFrozen: nextState };
        }
        return t;
      })
    );
  };

  // Add / Edit Form submission
  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingTask) {
      // Edit mode
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: formTitle,
                description: formDesc,
                duration: formDuration,
                priority: formPriority,
                period: formPeriod,
                category: formCategory,
                timeOfDay: formTimeOfDay,
                scheduledTime: formScheduledTime || (t.timeOfDay === formTimeOfDay ? t.scheduledTime : (formTimeOfDay === "Morning" ? "09:00" : formTimeOfDay === "Afternoon" ? "14:00" : formTimeOfDay === "Evening" ? "18:00" : "12:00")),
                timeFrozen: formTimeFrozen,
              }
            : t
        )
      );
      triggerNotification("Task Modified", `Updated details for "${formTitle}".`, "info");
      setEditingTask(null);
    } else {
      // Add mode
      const newTask: Task = {
        id: `task-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        title: formTitle,
        description: formDesc,
        duration: formDuration,
        priority: formPriority,
        period: formPeriod,
        category: formCategory,
        timeOfDay: formTimeOfDay,
        completed: false,
        scheduledTime: formScheduledTime || (formTimeOfDay === "Morning" ? "09:00" : formTimeOfDay === "Afternoon" ? "14:00" : formTimeOfDay === "Evening" ? "18:00" : "12:00"),
        timeFrozen: formTimeFrozen,
      };
      setTasks((prev) => [newTask, ...prev]);
      triggerNotification("Task Created", `"${formTitle}" added to your ${formPeriod} list.`, "success");
      setIsAddingTask(false);
    }

    // Reset Form
    setFormTitle("");
    setFormDesc("");
    setFormDuration(30);
    setFormPriority("medium");
    setFormCategory("work");
    setFormTimeOfDay("Morning");
    setFormScheduledTime("");
    setFormTimeFrozen(false);
    setActiveMobileTab('tasks');
  };

  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormDuration(task.duration);
    setFormPriority(task.priority);
    setFormPeriod(task.period);
    setFormCategory(task.category);
    setFormTimeOfDay(task.timeOfDay);
    setFormScheduledTime(task.scheduledTime || "");
    setFormTimeFrozen(!!task.timeFrozen);
    setActiveMobileTab('input');
  };

  // Progress & Stats Metrics
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const todayTasks = tasks.filter((t) => t.period === 'today');
  const todayTotalCount = todayTasks.length;
  const todayCompletedCount = todayTasks.filter((t) => t.completed).length;

  const tomorrowTasks = tasks.filter((t) => t.period === 'tomorrow');
  const tomorrowTotalCount = tomorrowTasks.length;
  const tomorrowCompletedCount = tomorrowTasks.filter((t) => t.completed).length;

  const highTasks = tasks.filter((t) => t.priority === 'high');
  const highTotalCount = highTasks.length;
  const highCompletedCount = highTasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-nature-100 dark:bg-nature-950 text-nature-900 dark:text-nature-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-sage-200/50 selection:text-sage-850 transition-colors duration-300" id="main-app-container">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-sage-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-nature-300/20 blur-[130px] pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-nature-200 dark:border-nature-800 bg-white/90 dark:bg-nature-900/90 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between shadow-xs transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-sage-600 flex items-center justify-center shadow-md shadow-sage-600/15 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black tracking-tight text-nature-950 dark:text-nature-50">
              ZEN FLOW
            </h1>
            <p className="text-[9px] sm:text-[10px] text-sage-600 font-bold uppercase tracking-wider font-mono">
              AI-Powered Scheduler
            </p>
          </div>
        </div>

        {/* Dynamic Clock and Control Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex flex-col items-end pr-4 border-r border-nature-200 dark:border-nature-800">
            <span className="text-xs font-mono font-bold text-nature-800 dark:text-nature-200">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[9px] text-nature-500 dark:text-nature-400 font-mono">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <NotificationCenter
            notifications={notifications}
            onClearAll={() => setNotifications([])}
            onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onToggleMute={() => setIsMuted(!isMuted)}
            isMuted={isMuted}
          />

          {/* Custom Theme Selector Dropdown */}
          <div className="relative max-w-[44px] sm:max-w-none">
            <select
              value={themeOption}
              onChange={(e) => setThemeOption(e.target.value as any)}
              className={`p-2 pr-2 sm:pr-8 pl-8 sm:pl-9 rounded-xl border appearance-none font-mono text-[11px] font-bold transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-sage-500/50 w-11 sm:w-auto text-transparent sm:text-inherit overflow-hidden ${
                isDarkMode
                  ? "bg-nature-850 border-nature-750 text-nature-150 hover:bg-nature-800"
                  : "bg-nature-50 border-nature-250 text-nature-800 hover:bg-nature-100"
              }`}
              title="Select UI Theme Scheme"
            >
              <option value="forest">🌲 Forest Moss</option>
              <option value="nordic">❄️ Nordic Frost</option>
              <option value="crimson">🌶️ Crimson Sand</option>
              <option value="orchid">🌸 Royal Orchid</option>
            </select>
            <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Palette className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
            </div>
            {/* Custom arrow down */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-nature-400 dark:text-nature-500 text-[9px] hidden sm:block">
              ▼
            </div>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              isDarkMode
                ? "bg-nature-850 hover:bg-nature-800 border-nature-750 text-amber-400 hover:text-amber-300"
                : "bg-nature-50 border-nature-250 hover:bg-nature-100 text-nature-700 hover:text-nature-950"
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Primary Layout Wrapper */}
      <main className="flex-1 flex flex-col h-full max-w-[1600px] mx-auto w-full p-4 md:p-6 pb-28 lg:pb-6 gap-6 relative">
        
        {/* System Offline / Fallback Warnings Panel */}
        {fallbackNotifications.length > 0 && (
          <div className="w-full flex flex-col gap-2.5 z-40">
            <AnimatePresence>
              {fallbackNotifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 dark:border-rose-900/40 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-md backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-450 shrink-0">
                      <AlertCircle className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wider font-mono">
                          {notif.title}
                        </h4>
                        <span className="text-[10px] font-mono text-rose-500/80 dark:text-rose-400/80 bg-rose-500/15 px-1.5 py-0.5 rounded font-bold">
                          {notif.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-rose-700/90 dark:text-rose-300/80 mt-1 font-medium leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFallbackNotifications(prev => prev.filter(n => n.id !== notif.id))}
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 hover:bg-rose-500/15 transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Input and Schedule Control */}
        <div className={`flex-1 flex flex-col space-y-6 min-w-0 ${activeMobileTab === 'tasks' || activeMobileTab === 'input' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* AI Parser Area */}
          <div className={`bg-white dark:bg-nature-900 border border-nature-200/80 dark:border-nature-800 rounded-2xl p-5 shadow-xs transition-colors duration-300 ${activeMobileTab === 'input' ? 'block' : 'hidden lg:block'}`} id="ai-parser-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-sage-600" />
                <h2 className="text-xs font-bold text-nature-800 dark:text-nature-200 uppercase tracking-wider font-mono">
                  Dump Tasks & Schedulers
                </h2>
              </div>
              <span className="text-[10px] text-nature-500 dark:text-nature-400 font-medium hidden sm:block">
                Drag-and-Drop .txt file or paste raw thoughts
              </span>
            </div>

            {/* Drag & Drop Frame */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 transition-all relative ${
                dragActive 
                  ? "border-sage-500 bg-sage-500/5 scale-[0.99]" 
                  : "border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-700 bg-nature-50/40 dark:bg-nature-950/40"
              }`}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Type, dictate, or drop your task file here... (e.g. "Today: Review designs at 10am, run at 4pm. Tomorrow: Gym workout in evening, finish proposal [high priority]")`}
                className="w-full min-h-[90px] bg-transparent border-0 resize-none text-xs text-nature-800 dark:text-nature-100 placeholder-nature-450 dark:placeholder-nature-600 focus:outline-none focus:ring-0 leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between border-t border-nature-150 dark:border-nature-850 mt-3 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-nature-100 hover:bg-nature-200/80 dark:bg-nature-800 dark:hover:bg-nature-750 border border-nature-300 dark:border-nature-700 rounded-lg text-[11px] font-semibold text-nature-700 hover:text-nature-900 dark:text-nature-200 dark:hover:text-white transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .txt File</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".txt,.md"
                    className="hidden"
                  />

                  {/* Voice Dictation Button */}
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      isListening
                        ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-400 animate-pulse"
                        : "bg-nature-100 hover:bg-nature-200/80 dark:bg-nature-800 dark:hover:bg-nature-750 border-nature-300 dark:border-nature-700 text-nature-700 hover:text-nature-900 dark:text-nature-200 dark:hover:text-white"
                    }`}
                    title={isListening ? "Stop listening" : "Speak to dictate tasks via microphone"}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span className="font-bold">Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Voice Dictate</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleParseTasksWithAI}
                  disabled={isParsing || !inputText.trim()}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    isParsing || !inputText.trim()
                      ? "bg-nature-200 dark:bg-nature-800 text-nature-400 dark:text-nature-600 cursor-not-allowed border border-nature-200 dark:border-nature-800"
                      : "bg-sage-600 hover:bg-sage-700 text-white border border-sage-500 active:scale-[0.98]"
                  }`}
                  id="parse-btn"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gemini reading file...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse Tasks with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {parseError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Task Completion Progress Bar Card */}
          <div className={`bg-white dark:bg-nature-900 rounded-2xl border border-nature-200/80 dark:border-nature-800 p-5 shadow-xs mb-2 transition-colors duration-300 ${activeMobileTab === 'tasks' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-nature-800 dark:text-nature-100 flex items-center gap-1.5">
                  <TrendingUp className="w-4.5 h-4.5 text-sage-600 dark:text-sage-400" />
                  <span>Productivity Momentum Tracker</span>
                </h3>
                <p className="text-xs text-nature-550 dark:text-nature-300 mt-0.5">
                  You have achieved <span className="font-bold text-sage-600 dark:text-sage-450">{completedTasksCount} of {totalTasksCount} tasks</span> completed overall across your schedules.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-extrabold text-sage-700 dark:text-sage-300 font-mono bg-sage-50 dark:bg-sage-950/40 border border-sage-100 dark:border-sage-800/80 rounded-lg px-2.5 py-1">
                  {completionPercentage}% Complete
                </span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="w-full bg-nature-150 dark:bg-nature-800 h-2 rounded-full mt-4 overflow-hidden relative border border-nature-200/30 dark:border-nature-700/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-400 dark:to-sage-600 rounded-full"
              />
            </div>
            
            {/* Split Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-nature-100 dark:border-nature-800 text-[10px] font-mono font-semibold text-nature-500 dark:text-nature-400 text-center">
              <div className="flex items-center gap-1.5 justify-center border-r border-nature-100 dark:border-nature-800">
                <span className="w-2 h-2 rounded-full bg-sage-500" />
                <span>Today: {todayCompletedCount}/{todayTotalCount}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center border-r border-nature-100 dark:border-nature-800">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Tomorrow: {tomorrowCompletedCount}/{tomorrowTotalCount}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>High: {highCompletedCount}/{highTotalCount}</span>
              </div>
            </div>
          </div>

          {/* Schedule Board Header and Views Controller */}
          <div className={`flex flex-col space-y-4 ${activeMobileTab === 'tasks' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Period Select Tabs */}
              <div className="flex bg-nature-200/60 p-1 rounded-xl border border-nature-300/40 self-start">
                <button
                  onClick={() => setActivePeriod('yesterday')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activePeriod === 'yesterday'
                      ? "bg-sage-600 text-white shadow-xs"
                      : "text-nature-600 hover:text-nature-900"
                  }`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setActivePeriod('today')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activePeriod === 'today'
                      ? "bg-sage-600 text-white shadow-xs"
                      : "text-nature-600 hover:text-nature-900"
                  }`}
                >
                  Today's Flow
                </button>
                <button
                  onClick={() => setActivePeriod('tomorrow')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activePeriod === 'tomorrow'
                      ? "bg-sage-600 text-white shadow-xs"
                      : "text-nature-600 hover:text-nature-900"
                  }`}
                >
                  Tomorrow's Focus
                </button>
              </div>

              {/* View toggle (List vs Calendar) */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <div className="relative" id="ai-scheduler-wrapper">
                  <button
                    onClick={() => setShowSchedulerSettings(!showSchedulerSettings)}
                    disabled={isPrioritizing || tasks.length === 0}
                    className={`p-2 border rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all ${
                      isPrioritizing 
                        ? "bg-nature-100 text-nature-400 cursor-wait border-nature-200" 
                        : tasks.length === 0 
                        ? "bg-nature-50 text-nature-300 border-nature-150 cursor-not-allowed" 
                        : "bg-sage-50 hover:bg-sage-100 border-sage-200 text-sage-700 hover:text-sage-800 cursor-pointer"
                    }`}
                    id="auto-prioritize-btn"
                    title="Configure options and schedule tasks with AI"
                  >
                    {isPrioritizing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-sage-600" />
                    )}
                    <span>{isPrioritizing ? "Scheduling..." : "AI Scheduler"}</span>
                  </button>

                  <AnimatePresence>
                    {showSchedulerSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute right-0 mt-2 p-4 rounded-2xl border border-nature-250 dark:border-nature-800 bg-white/95 dark:bg-nature-900/95 backdrop-blur-md shadow-xl w-72 text-left space-y-3.5 z-50 transition-colors duration-300 font-sans"
                      >
                        <div className="flex items-center justify-between border-b border-nature-150 dark:border-nature-800 pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-nature-850 dark:text-nature-100 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
                            Scheduler Settings
                          </h4>
                        </div>

                        {/* Breaks Option */}
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            id="schedule-breaks"
                            checked={schedulerIncludeBreaks}
                            onChange={(e) => setSchedulerIncludeBreaks(e.target.checked)}
                            className="mt-1 w-3.5 h-3.5 text-sage-600 border-nature-300 rounded focus:ring-sage-500 cursor-pointer"
                          />
                          <div className="text-left">
                            <label htmlFor="schedule-breaks" className="text-xs font-bold text-nature-850 dark:text-nature-150 block cursor-pointer select-none">
                              Include breaks / blanks
                            </label>
                            <span className="text-[10px] text-nature-450 dark:text-nature-400 leading-tight block">
                              Add short break tasks automatically after focus sessions.
                            </span>
                          </div>
                        </div>

                        {/* Mix Categories Option */}
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            id="schedule-mix"
                            checked={schedulerMixCategories}
                            onChange={(e) => setSchedulerMixCategories(e.target.checked)}
                            className="mt-1 w-3.5 h-3.5 text-sage-600 border-nature-300 rounded focus:ring-sage-500 cursor-pointer"
                          />
                          <div className="text-left">
                            <label htmlFor="schedule-mix" className="text-xs font-bold text-nature-850 dark:text-nature-150 block cursor-pointer select-none">
                              Alternate categories
                            </label>
                            <span className="text-[10px] text-nature-450 dark:text-nature-400 leading-tight block">
                              Avoid back-to-back tasks of the same type to maintain interest.
                            </span>
                          </div>
                        </div>

                        {/* Mind Habits Option */}
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            id="schedule-mind-habits"
                            checked={mindHabits}
                            onChange={(e) => setMindHabits(e.target.checked)}
                            className="mt-1 w-3.5 h-3.5 text-sage-600 border-nature-300 rounded focus:ring-sage-500 cursor-pointer"
                          />
                          <div className="text-left">
                            <label htmlFor="schedule-mind-habits" className="text-xs font-bold text-nature-850 dark:text-nature-150 block cursor-pointer select-none">
                              Mind habits in schedule
                            </label>
                            <span className="text-[10px] text-nature-450 dark:text-nature-400 leading-tight block">
                              Leave gaps in the calendar and render translucent habit blocks.
                            </span>
                          </div>
                        </div>

                        {/* User custom context */}
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-nature-450 dark:text-nature-400 font-mono block">
                            Day Context / Preferences
                          </label>
                          <textarea
                            placeholder="e.g. morning is busy with calls, study in afternoon"
                            value={schedulerContext}
                            onChange={(e) => setSchedulerContext(e.target.value)}
                            rows={2}
                            className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-lg p-2 text-xs text-nature-850 dark:text-nature-150 focus:outline-none resize-none"
                          />
                        </div>

                        {/* Disclaimer */}
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 leading-normal font-medium">
                          ⚠️ Disclaimer: Running the AI scheduler updates priorities and timings, which directly alters the task card details in the main Tasks View.
                        </div>

                        {/* Trigger button */}
                        <button
                          onClick={handleAISchedule}
                          className="w-full py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate AI Schedule</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => {
                    setIsAddingTask(!isAddingTask);
                    if (!isAddingTask) {
                      setActiveMobileTab('input');
                    }
                  }}
                  className="p-2 bg-nature-100 hover:bg-nature-200/80 border border-nature-300 rounded-xl text-nature-700 hover:text-nature-900 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  id="add-task-toggle-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Quick Add</span>
                </button>

                <div className="bg-nature-200/60 p-1 rounded-xl border border-nature-300/40 flex">
                  <button
                    onClick={() => setIsCalendarView(false)}
                    className={`p-1.5 rounded-lg transition-all ${
                      !isCalendarView ? "bg-nature-100 text-sage-700 shadow-xs" : "text-nature-400 hover:text-nature-600"
                    }`}
                    title="List Board View"
                  >
                    <List className="w-4.5 h-4.5" />
                  </button>
                  <button
                    onClick={() => setIsCalendarView(true)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isCalendarView ? "bg-nature-100 text-sage-700 shadow-xs" : "text-nature-400 hover:text-nature-600"
                    }`}
                    title="Interactive Calendar Timeline"
                  >
                    <Calendar className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Add/Edit Form */}
            <AnimatePresence>
              {(isAddingTask || editingTask) && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleSaveTask}
                  className="bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-2xl p-5 overflow-hidden space-y-4 shadow-sm transition-colors duration-300"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-sage-600 dark:text-sage-400 uppercase tracking-wider font-mono">
                      {editingTask ? "Modify Task Parameters" : "Draft Custom Task"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTask(false);
                        setEditingTask(null);
                        setActiveMobileTab('tasks');
                      }}
                      className="text-nature-400 hover:text-nature-600 dark:hover:text-nature-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Task Title</label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Draft team strategy summary"
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 placeholder-nature-400 dark:placeholder-nature-600 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Estimated Duration (m)</label>
                      <input
                        type="number"
                        min="5"
                        max="480"
                        value={formDuration}
                        onChange={(e) => setFormDuration(parseInt(e.target.value) || 30)}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Notes / Directives</label>
                    <textarea
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Add auxiliary comments or specific reminders"
                      className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 placeholder-nature-400 dark:placeholder-nature-600 min-h-[60px] focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Priority</label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as any)}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Day</label>
                      <select
                        value={formPeriod}
                        onChange={(e) => setFormPeriod(e.target.value as any)}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950"
                      >
                        <option value="yesterday">Yesterday</option>
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Time Bucket</label>
                      <select
                        value={formTimeOfDay}
                        onChange={(e) => setFormTimeOfDay(e.target.value)}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Evening">Evening</option>
                        <option value="Anytime">Anytime</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Specific Time</label>
                      <input
                        type="time"
                        value={formScheduledTime}
                        onChange={(e) => {
                          setFormScheduledTime(e.target.value);
                          if (e.target.value) setFormTimeFrozen(true);
                        }}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-850 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col justify-end">
                      <div className="flex items-center gap-2 h-[38px] pb-2">
                        <input
                          type="checkbox"
                          id="formTimeFrozen"
                          checked={formTimeFrozen}
                          onChange={(e) => setFormTimeFrozen(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-sage-600 border-nature-300 focus:ring-sage-500 cursor-pointer"
                        />
                        <label htmlFor="formTimeFrozen" className="text-xs font-bold text-nature-750 dark:text-nature-200 cursor-pointer select-none">
                          Freeze Time
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-nature-500 dark:text-nature-400 font-mono">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-xl px-3.5 py-2 text-xs text-nature-800 dark:text-nature-100 focus:outline-none focus:border-sage-500 focus:bg-white dark:focus:bg-nature-950"
                      >
                        <option value="work">Work</option>
                        <option value="personal">Personal</option>
                        <option value="health">Health</option>
                        <option value="learning">Learning</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sage-600/10"
                  >
                    {editingTask ? "Apply Parameter Updates" : "Save Task Details"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* BOARD MAIN VIEW CONTAINER */}
            <div>
              {activePeriod === 'yesterday' && !isCalendarView && (
                <div className="space-y-4 mb-4">
                  {/* Yesterday's Summary section */}
                  {tasks.filter((t) => t.period === 'yesterday').length > 0 && (
                    <div className="bg-gradient-to-br from-sage-50 to-white dark:from-nature-900 dark:to-nature-950 rounded-2xl border border-sage-200/80 dark:border-nature-800 p-5 shadow-xs">
                      <div className="flex items-center justify-between gap-3 border-b border-sage-100 dark:border-nature-800 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <History className="w-5 h-5 text-sage-600 animate-pulse" />
                          <div>
                            <h4 className="font-bold text-sm text-nature-850 dark:text-nature-100">Previous Day Retrospective</h4>
                            <p className="text-[10px] text-nature-500 dark:text-nature-400">AI Personal Coach analysis of yesterday's accomplishments</p>
                          </div>
                        </div>
                        <button
                          onClick={handleGenerateYesterdaySummary}
                          disabled={isGeneratingSummary}
                          className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-200 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          {isGeneratingSummary ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Compiling...</span>
                            </>
                          ) : yesterdaySummary ? (
                            <span>Regenerate Analysis</span>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>Compile Retrospective</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Summary Body */}
                      {isGeneratingSummary ? (
                        <div className="py-8 text-center space-y-2">
                          <Loader2 className="w-6 h-6 text-sage-500 animate-spin mx-auto" />
                          <p className="text-xs text-nature-600 dark:text-nature-400 font-medium">Deconstructing yesterday's productivity pattern...</p>
                        </div>
                      ) : yesterdaySummary ? (
                        <div className="space-y-4 text-sm">
                          <div className="bg-sage-500/10 dark:bg-nature-900/40 rounded-xl p-4 border-l-4 border-sage-600 dark:border-sage-500">
                            <h5 className="font-bold text-nature-950 dark:text-white uppercase tracking-wider text-[10px] font-mono text-sage-700 dark:text-sage-400 mb-1.5">
                              Achievements Overview
                            </h5>
                            <p className="text-nature-900 dark:text-nature-150 text-sm leading-relaxed font-medium">
                              {yesterdaySummary.overview}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-nature-900/80 rounded-xl p-4 border border-sage-200 dark:border-nature-800 space-y-3 shadow-xs">
                              <h5 className="font-bold text-nature-950 dark:text-white uppercase tracking-wider text-[10px] font-mono text-sage-600 dark:text-sage-450 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
                                Actionable Coach Tips
                              </h5>
                              <ul className="space-y-2 text-sm text-nature-900 dark:text-nature-200">
                                {yesterdaySummary.recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sage-500 mt-2 shrink-0" />
                                    <span className="font-medium">{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="bg-amber-50/30 dark:bg-amber-950/10 rounded-xl p-4 border border-amber-200/50 dark:border-amber-900/30 flex flex-col justify-center items-center text-center space-y-2 shadow-xs">
                              <h5 className="font-bold text-nature-950 dark:text-white uppercase tracking-wider text-[10px] font-mono text-amber-700 dark:text-amber-550 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-450" />
                                Mantra of the Day
                              </h5>
                              <p className="text-base italic font-bold text-amber-900 dark:text-amber-200 leading-relaxed px-2">
                                "{yesterdaySummary.mantra}"
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-nature-500 dark:text-nature-400 space-y-3 bg-white/40 dark:bg-nature-900/20 border border-nature-200/50 dark:border-nature-800/50 border-dashed rounded-xl">
                          <Sparkles className="w-6 h-6 mx-auto text-nature-400 dark:text-nature-500 opacity-60" />
                          <p className="text-xs font-semibold text-nature-700 dark:text-nature-250">No retrospective compiled yet</p>
                          <p className="text-[11px] text-nature-400 dark:text-nature-500 max-w-xs mx-auto">
                            Let Gemini inspect your tasks and output an executive performance review.
                          </p>
                          <button
                            onClick={handleGenerateYesterdaySummary}
                            className="px-4 py-1.5 bg-sage-500 hover:bg-sage-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Generate Retrospective Now
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Overflow Tray Card */}
              {tasks.some((t) => t.period === 'overflow') && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 shadow-xs space-y-3 font-sans text-left">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4.5 h-4.5" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                      AI Schedule Overflow ({tasks.filter((t) => t.period === 'overflow').length} Tasks)
                    </h4>
                  </div>
                  <p className="text-[11px] text-nature-600 dark:text-nature-350 leading-normal">
                    These tasks could not fit in today's remaining time (before 11:00 PM) without causing schedule overlaps. Choose how to resolve them:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tasks
                      .filter((t) => t.period === 'overflow')
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 p-3 rounded-xl flex items-start justify-between gap-3 text-left shadow-2xs hover:border-nature-350 dark:hover:border-nature-700 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-nature-950 dark:text-white truncate">
                              {task.title}
                            </h5>
                            <span className="text-[10px] text-nature-500 dark:text-nature-450 font-mono">
                              Duration: {task.duration} mins
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-center">
                            <button
                              onClick={() => handleJamInToday(task.id)}
                              className="px-2 py-1 bg-sage-50 hover:bg-sage-100 dark:bg-sage-950/30 dark:hover:bg-sage-900 border border-sage-200/60 dark:border-sage-800/40 text-[10px] font-bold text-sage-700 dark:text-sage-300 rounded-lg cursor-pointer transition-colors"
                              title="Force this task into today's timeline"
                            >
                              Jam Today
                            </button>
                            <button
                              onClick={() => handleMigrateToTomorrow(task.id)}
                              className="px-2 py-1 bg-nature-100 hover:bg-nature-200 dark:bg-nature-800 dark:hover:bg-nature-750 border border-nature-200 dark:border-nature-700 text-[10px] font-bold text-nature-700 dark:text-nature-300 rounded-lg cursor-pointer transition-colors"
                              title="Migrate task to tomorrow's list"
                            >
                              Move Tomorrow
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {isCalendarView ? (
                /* Timeline Calendar Agenda View */
                <CalendarAgenda
                  tasks={tasks}
                  period={activePeriod}
                  onUpdateTaskTime={handleUpdateTaskTime}
                  onSelectTaskWorkflow={handleSelectWorkflowTask}
                  onToggleComplete={handleToggleComplete}
                  onToggleFreeze={handleToggleTaskFreeze}
                  habits={habits}
                  mindHabits={mindHabits}
                  onHabitClick={handleCalendarHabitClick}
                  onViewTask={handleCalendarTaskView}
                />
              ) : (
                /* Kanban List Column View */
                <div className="bg-white dark:bg-nature-900 rounded-2xl border border-nature-200 dark:border-nature-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-nature-800 dark:text-nature-100 flex items-center gap-1.5 capitalize">
                      <CheckCircle className="w-4.5 h-4.5 text-sage-600" />
                      <span>{activePeriod} Task Schedule</span>
                    </h3>
                    <span className="text-xs text-nature-400 dark:text-nature-500 font-mono">
                      {tasks.filter((t) => t.period === activePeriod && t.completed).length}/
                      {tasks.filter((t) => t.period === activePeriod).length} Complete
                    </span>
                  </div>

                  <div className="space-y-3">
                    {tasks.filter((t) => t.period === activePeriod).length === 0 ? (
                      activePeriod === 'yesterday' ? (
                        <div className="py-14 text-center text-nature-400 dark:text-nature-500 border border-nature-200 dark:border-nature-800 border-dashed rounded-xl bg-nature-50/20 dark:bg-nature-950/20 px-4">
                          <History className="w-8 h-8 mx-auto opacity-30 mb-2 text-nature-300 dark:text-nature-600" />
                          <p className="text-xs font-semibold text-nature-700 dark:text-nature-200">Yesterday's Summary Unavailable</p>
                          <p className="text-[11px] mt-1 text-nature-400 dark:text-nature-500 max-w-sm mx-auto leading-relaxed">
                            Previous day's productivity summary is unavailable. No tasks were checked off or registered for that day. 
                            Start ticking off tasks, or seed simulated tasks below to test out the retrospective coach!
                          </p>
                          <button
                            onClick={handleSeedYesterdayTasks}
                            className="mt-4 px-4 py-2 bg-sage-100 dark:bg-sage-950/40 hover:bg-sage-200 dark:hover:bg-sage-900 border border-sage-200/60 dark:border-sage-800/60 rounded-xl text-xs font-bold text-sage-700 dark:text-sage-300 hover:text-sage-800 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            Seed Simulated Completed Tasks
                          </button>
                        </div>
                      ) : (
                        <div className="py-14 text-center text-nature-400 dark:text-nature-500 border border-nature-200 dark:border-nature-800 border-dashed rounded-xl bg-nature-50/20 dark:bg-nature-950/20">
                          <CheckCircle2 className="w-8 h-8 mx-auto opacity-30 mb-2 text-nature-300 dark:text-nature-600" />
                          <p className="text-xs font-semibold text-nature-700 dark:text-nature-200">No Scheduled Actions</p>
                          <p className="text-[11px] mt-1 text-nature-400 dark:text-nature-500">
                            Paste your list above or click "Quick Add" to draft manually.
                          </p>
                        </div>
                      )
                    ) : (
                      tasks
                        .filter((t) => t.period === activePeriod)
                        .map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onSelectWorkflow={handleSelectWorkflowTask}
                            onDeleteTask={handleDeleteTask}
                            onEditTask={handleStartEdit}
                            onMigrateTask={handleMigrateTask}
                            isHighlighted={highlightedTaskId === task.id}
                          />
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Focus and Workflow panel / Habits Manager Cockpit */}
        <div className={`w-full lg:w-[420px] xl:w-[480px] shrink-0 relative ${activeMobileTab === 'focus' || activeMobileTab === 'habits' || activeMobileTab === 'scorecard' ? 'block' : 'hidden lg:block'}`} id="right-workflow-panel">
          <div className="lg:sticky lg:top-[80px] lg:max-h-[calc(100vh-96px)] h-auto lg:h-[calc(100vh-96px)] overflow-visible lg:overflow-hidden rounded-2xl border border-nature-200 dark:border-nature-800 bg-white dark:bg-nature-900 flex flex-col shadow-lg transition-colors duration-300">
            {/* Header Tabs */}
            <div className="hidden lg:flex border-b border-nature-150 dark:border-nature-855 bg-nature-50/50 dark:bg-nature-950/20 p-2 gap-1 rounded-t-2xl shrink-0">
              <button
                onClick={() => setRightPanelTab('focus')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'focus'
                    ? "bg-sage-600 text-white shadow-xs"
                    : "text-nature-600 hover:text-nature-900 dark:text-nature-400 hover:bg-nature-100 dark:hover:bg-nature-800"
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Focus Workflow</span>
              </button>
              <button
                onClick={() => setRightPanelTab('habits')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'habits'
                    ? "bg-sage-600 text-white shadow-xs"
                    : "text-nature-600 hover:text-nature-900 dark:text-nature-400 hover:bg-nature-100 dark:hover:bg-nature-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Habits Manager</span>
              </button>
              <button
                onClick={() => setRightPanelTab('tracker')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'tracker'
                    ? "bg-sage-600 text-white shadow-xs"
                    : "text-nature-600 hover:text-nature-900 dark:text-nature-400 hover:bg-nature-100 dark:hover:bg-nature-800"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Scorecard</span>
              </button>
            </div>

            {/* Tab Body */}
            {rightPanelTab === 'focus' ? (
              selectedWorkflowTask ? (
                <FocusWorkflowPanel
                  task={selectedWorkflowTask}
                  onClose={() => setSelectedWorkflowTask(null)}
                  onTriggerNotification={triggerNotification}
                  onCompleteTask={handleToggleComplete}
                  bypassAI={bypassAI}
                  onAddTokens={recordRequest}
                  model={selectedAiModel}
                  onAddFallbackWarning={addFallbackNotification}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-nature-500 dark:text-nature-400 py-24 bg-nature-50/10 dark:bg-nature-950/20">
                  <div className="w-12 h-12 rounded-2xl bg-nature-50 dark:bg-nature-800 border border-nature-200 dark:border-nature-750 flex items-center justify-center text-sage-600 dark:text-sage-400 mb-4 shadow-sm">
                    <Play className="w-5 h-5 ml-0.5 animate-pulse text-sage-600 dark:text-sage-400" />
                  </div>
                  <h3 className="text-xs font-bold text-nature-700 dark:text-nature-200 uppercase tracking-wider font-mono">
                    Focus Workflow Center
                  </h3>
                  <p className="text-[11px] mt-2 text-nature-550 dark:text-nature-350 leading-relaxed max-w-[240px]">
                    Select a task card and click <strong>Focus</strong> to instantiate a step-by-step interactive AI blueprint, Pomodoro countdown deck, and live binaural sounds.
                  </p>
                </div>
              )
            ) : rightPanelTab === 'habits' ? (
              /* Compact Habits Manager Dashboard inside the right panel */
              <div className="flex-1 lg:overflow-y-auto overflow-visible p-4 space-y-4 lg:max-h-[calc(100vh-200px)]">
                <div className="flex items-center justify-between border-b border-nature-150 dark:border-nature-850 pb-2">
                  <h4 className="text-sm font-bold text-nature-800 dark:text-nature-200">
                    Recurring Habits
                  </h4>
                  <button
                    onClick={() => setIsAddingHabit(!isAddingHabit)}
                    className="px-2 py-1 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{isAddingHabit ? "Close" : "Add Habit"}</span>
                    {!isAddingHabit && <Plus className="w-3 h-3" />}
                  </button>
                </div>

                {/* Add / Edit Habit Form */}
                <AnimatePresence>
                  {(isAddingHabit || editingHabit) && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleSaveHabit}
                      className="bg-nature-50/50 dark:bg-nature-950/40 border border-nature-200 dark:border-nature-800 rounded-xl p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sage-600 dark:text-sage-400 font-mono">
                          {editingHabit ? "Edit Habit" : "New Habit"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingHabit(false);
                            setEditingHabit(null);
                          }}
                          className="text-nature-450 hover:text-nature-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-nature-555 dark:text-nature-400 font-mono">Name</label>
                        <input
                          type="text"
                          required
                          value={habitFormTitle}
                          onChange={(e) => setHabitFormTitle(e.target.value)}
                          placeholder="e.g. Drink Water"
                          className="w-full bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-lg px-2.5 py-1.5 text-xs text-nature-800 dark:text-nature-100 placeholder-nature-455 dark:placeholder-nature-600 focus:outline-none focus:border-sage-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-nature-555 dark:text-nature-400 font-mono">Time</label>
                          <input
                            type="time"
                            required
                            value={habitFormTime}
                            onChange={(e) => setHabitFormTime(e.target.value)}
                            className="w-full bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-lg px-2 py-1 text-xs text-nature-800 dark:text-nature-100 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-nature-555 dark:text-nature-400 font-mono">Duration</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="240"
                            value={habitFormDuration}
                            onChange={(e) => setHabitFormDuration(parseInt(e.target.value) || 15)}
                            className="w-full bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-lg px-2 py-1 text-xs text-nature-800 dark:text-nature-100 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-nature-555 dark:text-nature-400 font-mono">Description</label>
                        <textarea
                          value={habitFormDesc}
                          onChange={(e) => setHabitFormDesc(e.target.value)}
                          placeholder="Routine notes..."
                          className="w-full bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-lg px-2 py-1 text-xs text-nature-800 dark:text-nature-100 placeholder-nature-455 min-h-[40px] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-nature-555 dark:text-nature-400 font-mono">Category</label>
                          <select
                            value={habitFormCategory}
                            onChange={(e) => setHabitFormCategory(e.target.value)}
                            className="w-full bg-white dark:bg-nature-900 border border-nature-250 dark:border-nature-800 rounded-lg p-1 text-xs text-nature-800 dark:text-nature-100"
                          >
                            <option value="health">Health</option>
                            <option value="work">Work</option>
                            <option value="learning">Learning</option>
                            <option value="personal">Personal</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 pt-4">
                          <input
                            type="checkbox"
                            id="habitFormEnabledRight"
                            checked={habitFormEnabled}
                            onChange={(e) => setHabitFormEnabled(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-sage-600 cursor-pointer"
                          />
                          <label htmlFor="habitFormEnabledRight" className="text-xs font-bold text-nature-750 dark:text-nature-200 cursor-pointer select-none">
                            Active
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        {editingHabit ? "Update Habit" : "Save Habit"}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Habit Cards */}
                <div className="space-y-2.5">
                  {habits.length === 0 ? (
                    <div className="py-8 text-center text-nature-400 dark:text-nature-500 border border-nature-200 dark:border-nature-800 border-dashed rounded-xl bg-nature-50/20">
                      <p className="text-xs font-semibold text-nature-700 dark:text-nature-200">No Habits Configured</p>
                      <p className="text-xs mt-0.5 text-nature-450">Click "Add Habit" to register routines.</p>
                    </div>
                  ) : (
                    habits.map((habit) => {
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
                          key={habit.id}
                          id={`habit-card-${habit.id}`}
                          className={`p-3 rounded-xl border transition-all duration-200 text-left relative ${
                            highlightedHabitId === habit.id
                              ? "ring-1 ring-sage-500/50 shadow-sm border-sage-400 z-10"
                              : !habit.enabled
                              ? "bg-nature-50/40 dark:bg-nature-950/20 border-nature-200 dark:border-nature-850 opacity-60"
                              : isCompleted
                              ? "bg-emerald-50/10 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/30"
                              : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-350 dark:hover:border-nature-700"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox for Enabled Habits */}
                            {habit.enabled && (
                              <button
                                onClick={() => handleToggleHabitCompleted(habit.id)}
                                className="mt-0.5 shrink-0 transition-transform active:scale-95 cursor-pointer focus:outline-none"
                                title={isCompleted ? "Mark incomplete" : "Mark completed"}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-nature-350 dark:border-nature-700 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors" />
                                )}
                              </button>
                            )}

                            <div className="min-w-0 flex-1">
                              <h5 className={`text-sm font-bold truncate ${
                                habit.enabled && isCompleted
                                  ? "line-through text-nature-400 dark:text-nature-550"
                                  : "text-nature-950 dark:text-white"
                              }`}>
                                {habit.title}
                              </h5>
                              {habit.description && (
                                <p className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${
                                  habit.enabled && isCompleted
                                    ? "line-through text-nature-400/70 dark:text-nature-550/70"
                                    : "text-nature-550 dark:text-nature-400"
                                }`}>
                                  {habit.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-mono">
                                <span className="text-sage-600 dark:text-sage-400 font-bold bg-sage-55/40 dark:bg-sage-950/40 px-1 py-0.5 rounded border border-sage-100/40">
                                  {habit.time} ({habit.duration}m)
                                </span>
                                {habit.enabled && habit.streak > 0 && (
                                  <button
                                    onClick={() => handleStreakClick(habit)}
                                    className={`flex items-center gap-0.5 font-extrabold px-1 py-0.5 rounded border transition-all cursor-pointer ${
                                      clickedStreakId === habit.id
                                        ? "bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 scale-110 animate-bounce"
                                        : "bg-orange-50/50 dark:bg-orange-950/20 border-orange-100/50 dark:border-orange-900/20 text-orange-600 dark:text-orange-400 hover:scale-105 active:scale-95"
                                    }`}
                                  >
                                    <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                                    <span>{habit.streak}d streak</span>
                                  </button>
                                )}
                                <span className="text-nature-450 dark:text-nature-400 capitalize px-1 py-0.5 bg-nature-100 dark:bg-nature-800 rounded">
                                  {habit.category}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0 self-start">
                              <button
                                onClick={() => handleToggleHabitEnabled(habit.id)}
                                className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-nature-100 hover:bg-nature-200 dark:bg-nature-800 dark:hover:bg-nature-700 border border-nature-200 dark:border-nature-750 text-nature-700 dark:text-nature-300 cursor-pointer"
                              >
                                {habit.enabled ? "Pause" : "Resume"}
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditHabit(habit)}
                                  className="p-1 rounded hover:bg-nature-100 dark:hover:bg-nature-800 text-nature-450 hover:text-nature-700 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteHabit(habit.id)}
                                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-nature-450 hover:text-rose-600 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Productivity Tracker Dashboard */
              <div className="flex-1 lg:overflow-y-auto overflow-visible p-4 space-y-4 lg:max-h-[calc(100vh-200px)] text-left">
                <div className="flex items-center justify-between border-b border-nature-150 dark:border-nature-850 pb-2">
                  <h4 className="text-sm font-bold text-nature-800 dark:text-nature-200">
                    Productivity Scorecard
                  </h4>
                </div>

                {/* Archiving Toggle Card */}
                <div className="bg-nature-50/50 dark:bg-nature-950/40 border border-nature-200 dark:border-nature-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-nature-850 dark:text-nature-150 block font-sans">
                        Yesterday Archiving
                      </span>
                      <span className="text-[10px] text-nature-500 dark:text-nature-450 leading-relaxed block max-w-[280px]">
                        {keepYesterdayTasks
                          ? "Tasks remain accumulated in the Yesterday view history column on daily rollover."
                          : "Tasks are permanently deleted from database when they go past Yesterday."}
                      </span>
                    </div>
                    <button
                      onClick={() => setKeepYesterdayTasks(!keepYesterdayTasks)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        keepYesterdayTasks ? 'bg-sage-600' : 'bg-nature-250 dark:bg-nature-850'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          keepYesterdayTasks ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Score Stats Card */}
                {(() => {
                  const score = (totalCompletedTasks + totalUncompletedTasks) > 0
                    ? Math.round((totalCompletedTasks / (totalCompletedTasks + totalUncompletedTasks)) * 100)
                    : 0;

                  return (
                    <div className="bg-white dark:bg-nature-900 border border-nature-200 dark:border-nature-800 p-4 rounded-xl space-y-4">
                      <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-sage-600 dark:text-sage-450">
                        Productivity Stats
                      </h5>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex items-center justify-center shrink-0">
                          {/* Radial Progress Ring */}
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="currentColor"
                              strokeWidth="6"
                              className="text-nature-100 dark:text-nature-800"
                              fill="transparent"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="currentColor"
                              strokeWidth="6"
                              className={
                                score >= 80
                                  ? "text-emerald-500"
                                  : score >= 50
                                  ? "text-amber-500"
                                  : "text-rose-500"
                              }
                              strokeDasharray={2 * Math.PI * 32}
                              strokeDashoffset={2 * Math.PI * 32 * (1 - score / 100)}
                              fill="transparent"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-base font-bold text-nature-850 dark:text-white">
                              {score}%
                            </span>
                            <span className="text-[8px] uppercase font-bold text-nature-450 dark:text-nature-500 tracking-wider">
                              Score
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 w-full space-y-2">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-nature-450 dark:text-nature-500">Days Active:</span>
                            <span className="font-bold text-nature-850 dark:text-nature-200">{daysCount}d</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-nature-450 dark:text-nature-500">Completed Tasks:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-450">{totalCompletedTasks}</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-nature-450 dark:text-nature-500">Uncompleted Tasks:</span>
                            <span className="font-bold text-rose-600 dark:text-rose-450">{totalUncompletedTasks}</span>
                          </div>
                        </div>
                      </div>

                      {/* Reset Stats Trigger */}
                      <button
                        onClick={handleResetProductivity}
                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-900/40 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset Scorecard & Days count
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>

      {/* Exquisite Toast Alerts Banner */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 lg:bottom-6 lg:left-6 lg:right-auto lg:max-w-sm z-50 p-4 rounded-xl shadow-2xl border border-nature-200 dark:border-nature-800 bg-white/95 dark:bg-nature-900/95 backdrop-blur-md flex gap-3.5"
            id="toast-notification-banner"
          >
            <div className="shrink-0 mt-0.5">
              {activeToast.type === "success" ? (
                <div className="p-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                  <CheckCircle className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1 rounded-full bg-sage-50 dark:bg-sage-950/40 text-sage-600 dark:text-sage-400 border border-sage-100 dark:border-sage-900/40">
                  <Bell className="w-4 h-4" />
                </div>
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold text-nature-850 dark:text-nature-100">{activeToast.title}</h4>
              <p className="text-[11px] text-nature-600 dark:text-nature-350 mt-1 leading-normal">{activeToast.message}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="p-1 text-nature-400 dark:text-nature-500 hover:text-nature-600 dark:hover:text-nature-300 ml-auto self-start"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Google AI Studio Quota Monitor popover (Bottom-Right) */}
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40">
        <button
          onClick={() => setShowQuotaPopover(!showQuotaPopover)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border shadow-lg transition-all duration-305 font-mono text-[11px] font-bold cursor-pointer ${
            showQuotaPopover
              ? "bg-sage-600 border-sage-500 text-white"
              : "bg-white/90 dark:bg-nature-900/90 backdrop-blur-md border-nature-200 dark:border-nature-800 text-nature-700 dark:text-nature-200 hover:border-nature-350 dark:hover:border-nature-700"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Quota</span>
          <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey === true ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        </button>

        <AnimatePresence>
          {showQuotaPopover && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-12 right-0 p-4 rounded-2xl border border-nature-200 dark:border-nature-800 bg-white/95 dark:bg-nature-900/95 backdrop-blur-md shadow-2xl w-72 text-left space-y-3.5 transition-colors duration-300"
            >
              {/* Popover Header */}
              <div className="flex items-center justify-between border-b border-nature-150 dark:border-nature-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-nature-850 dark:text-nature-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />
                  AI Studio Quota
                </h4>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  hasApiKey === true
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/30"
                    : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30"
                }`}>
                  {hasApiKey === true ? "API Key Ok" : "No Key Found"}
                </span>
              </div>

              {/* Model & Tier dropdowns */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-nature-450 dark:text-nature-400 font-mono">Model Selection</label>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => setSelectedAiModel(e.target.value as any)}
                    className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-lg p-1 text-[10px] text-nature-850 dark:text-nature-150 focus:outline-none"
                  >
                    {availableModels.length > 0 ? (
                      availableModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.displayName}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-nature-450 dark:text-nature-400 font-mono">Pricing Tier</label>
                  <select
                    value={apiTier}
                    onChange={(e) => setApiTier(e.target.value as any)}
                    className="w-full bg-nature-50 dark:bg-nature-950 border border-nature-250 dark:border-nature-800 rounded-lg p-1 text-[10px] text-nature-850 dark:text-nature-150 focus:outline-none"
                  >
                    <option value="free">Free Tier</option>
                    <option value="pay-as-you-go">Pay-as-you-go</option>
                  </select>
                </div>
              </div>

              {/* Quota meters */}
              <div className="space-y-3 pt-2.5 border-t border-nature-150 dark:border-nature-800">
                {/* Requests Per Minute */}
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline text-[10px] font-mono">
                    <span className="text-nature-500 dark:text-nature-400">RPM (Reqs/Min)</span>
                    <span className="font-bold text-nature-850 dark:text-nature-200">
                      {requestsLog.filter(ts => Date.now() - ts < 60000).length} / {
                        selectedAiModel.includes('pro')
                          ? (selectedAiModel === 'gemini-1.5-pro' ? (apiTier === 'free' ? 2 : 1000) : (apiTier === 'free' ? 15 : 360))
                          : (apiTier === 'free' ? 15 : 2000)
                      }
                    </span>
                  </div>
                  <div className="w-full bg-nature-100 dark:bg-nature-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (requestsLog.filter(ts => Date.now() - ts < 60000).length / (
                          selectedAiModel.includes('pro')
                            ? (selectedAiModel === 'gemini-1.5-pro' ? (apiTier === 'free' ? 2 : 1000) : (apiTier === 'free' ? 15 : 360))
                            : (apiTier === 'free' ? 15 : 2000)
                        )) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Tokens Per Minute */}
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline text-[10px] font-mono">
                    <span className="text-nature-500 dark:text-nature-400">TPM (Tokens/Min)</span>
                    <span className="font-bold text-nature-850 dark:text-nature-200">
                      {tokensLog.filter(t => Date.now() - t.timestamp < 60000).reduce((sum, item) => sum + item.tokens, 0).toLocaleString()} / {
                        selectedAiModel.includes('pro')
                          ? (selectedAiModel === 'gemini-1.5-pro' ? (apiTier === 'free' ? "32,000" : "2,000,000") : (apiTier === 'free' ? "32,000" : "120,000"))
                          : (apiTier === 'free' ? "1,000,000" : "4,000,000")
                      }
                    </span>
                  </div>
                  <div className="w-full bg-nature-100 dark:bg-nature-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (tokensLog.filter(t => Date.now() - t.timestamp < 60000).reduce((sum, item) => sum + item.tokens, 0) / (
                          selectedAiModel.includes('pro')
                            ? (selectedAiModel === 'gemini-1.5-pro' ? (apiTier === 'free' ? 32000 : 2000000) : (apiTier === 'free' ? 32000 : 120000))
                            : (apiTier === 'free' ? 1000000 : 4000000)
                        )) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Requests Per Day */}
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline text-[10px] font-mono">
                    <span className="text-nature-500 dark:text-nature-400">RPD (Requests/Day)</span>
                    <span className="font-bold text-nature-850 dark:text-nature-200">
                      {requestsLog.filter(ts => Date.now() - ts < 86400000).length} / {
                        apiTier === 'free'
                          ? (selectedAiModel === 'gemini-1.5-pro' ? "50" : "1,500")
                          : "Unlimited"
                      }
                    </span>
                  </div>
                  {apiTier === 'free' && (
                    <div className="w-full bg-nature-100 dark:bg-nature-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sage-600 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (requestsLog.filter(ts => Date.now() - ts < 86400000).length / (
                            selectedAiModel === 'gemini-1.5-pro' ? 50 : 1500
                          )) * 100)}%`
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Database Live Checking Card */}
              <div className="space-y-2 pt-2.5 border-t border-nature-150 dark:border-nature-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-nature-800 dark:text-nature-200 uppercase tracking-wider">Database Status</span>
                  {dbStatus ? (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      dbStatus.connected
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/30"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-450 border border-amber-100 dark:border-amber-900/30"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {dbStatus.connected ? "Online MongoDB" : "Local JSON File"}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-nature-450">Loading...</span>
                  )}
                </div>
              </div>

              {/* Reset button & Info */}
              <div className="flex items-center justify-between pt-2 border-t border-nature-150 dark:border-nature-800">
                <span className="text-[9px] text-nature-450 dark:text-nature-500 italic max-w-[170px] leading-tight">
                  Token count is fetched dynamically from the Gemini response metadata.
                </span>
                <button
                  onClick={() => {
                    setTokensUsed(0);
                    setRequestsLog([]);
                    setTokensLog([]);
                    localStorage.setItem("zen_tokens_used", "0");
                    triggerNotification("Reset Stats", "Local request history and tokens usage cleared.", "success");
                  }}
                  className="text-[9px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {celebrationEffect && (
            <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
              <style>{`
                @keyframes float-particle {
                  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
              `}</style>
          {/* Confetti particles */}
              {Array.from({ length: 60 }).map((_, i) => {
                const size = Math.random() * 8 + 6;
                const delay = Math.random() * 2;
                const duration = Math.random() * 2 + 2;
                const left = Math.random() * 100;
                const colors = ["bg-amber-400", "bg-yellow-400", "bg-emerald-400", "bg-rose-400", "bg-indigo-400", "bg-teal-400"];
                const color = colors[Math.floor(Math.random() * colors.length)];
                return (
                  <div
                    key={i}
                    className={`absolute rounded-xs opacity-75 ${color}`}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      left: `${left}%`,
                      top: `-20px`,
                      animation: `float-particle ${duration}s linear ${delay}s infinite`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Mobile Floating Bottom Navigation */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 flex justify-center">
          <div className="w-full max-w-md bg-white/80 dark:bg-nature-900/80 backdrop-blur-lg border border-nature-200/80 dark:border-nature-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)] rounded-2xl px-3 py-2 flex items-center justify-between gap-1">
            {/* Tasks Tab */}
            <button
              onClick={() => setActiveMobileTab('tasks')}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                activeMobileTab === 'tasks'
                  ? "text-sage-600 dark:text-sage-400 font-bold scale-105"
                  : "text-nature-500 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-350"
              }`}
            >
              <List className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-tight">Tasks</span>
            </button>

            {/* Focus Tab */}
            <button
              onClick={() => {
                setActiveMobileTab('focus');
                setRightPanelTab('focus');
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                activeMobileTab === 'focus'
                  ? "text-sage-600 dark:text-sage-400 font-bold scale-105"
                  : "text-nature-500 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-350"
              }`}
            >
              <Play className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-tight">Focus</span>
            </button>

            {/* Habits Tab */}
            <button
              onClick={() => {
                setActiveMobileTab('habits');
                setRightPanelTab('habits');
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                activeMobileTab === 'habits'
                  ? "text-sage-600 dark:text-sage-400 font-bold scale-105"
                  : "text-nature-500 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-350"
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-tight">Habits</span>
            </button>

            {/* Dump / Input Tab */}
            <button
              onClick={() => setActiveMobileTab('input')}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                activeMobileTab === 'input'
                  ? "text-sage-600 dark:text-sage-400 font-bold scale-105"
                  : "text-nature-500 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-350"
              }`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-tight">Add</span>
            </button>

            {/* Scorecard Tab */}
            <button
              onClick={() => {
                setActiveMobileTab('scorecard');
                setRightPanelTab('tracker');
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
                activeMobileTab === 'scorecard'
                  ? "text-sage-600 dark:text-sage-400 font-bold scale-105"
                  : "text-nature-500 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-350"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-tight">Stats</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
