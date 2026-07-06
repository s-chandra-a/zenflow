import React, { useState, useEffect, useRef } from "react";
import { Task, TaskWorkflow, WorkflowStep } from "../types";
import { 
  X, Check, Play, Pause, RotateCcw, Flame, 
  HelpCircle, Volume2, VolumeX, Loader2, Sparkles, AlertCircle, BookOpen, Music
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FocusWorkflowPanelProps {
  task: Task;
  onClose: () => void;
  onTriggerNotification: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert') => void;
  onCompleteTask: (taskId: string) => void;
  bypassAI: boolean;
  onAddTokens: (count: number) => void;
  model?: string;
  onAddFallbackWarning?: (type: string, title: string, message: string) => void;
}

export default function FocusWorkflowPanel({
  task,
  onClose,
  onTriggerNotification,
  onCompleteTask,
  bypassAI,
  onAddTokens,
  model,
  onAddFallbackWarning,
}: FocusWorkflowPanelProps) {
  const [workflow, setWorkflow] = useState<TaskWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus Timer States
  const [timeLeft, setTimeLeft] = useState(task.duration * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState<'task' | 'pomodoro' | 'shortBreak'>('task');

  // Workflow Checklist States
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [activeRoadblock, setActiveRoadblock] = useState<number | null>(null);

  // Web Audio Synth State
  const [isSynthPlaying, setIsSynthPlaying] = useState(false);
  const [binauralType, setBinauralType] = useState<'theta' | 'alpha' | 'gamma'>('theta');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gainNode: GainNode } | null>(null);

  const handleBinauralTypeChange = (type: 'theta' | 'alpha' | 'gamma') => {
    setBinauralType(type);
    if (isSynthPlaying && synthNodesRef.current && audioCtxRef.current) {
      const rightFreq = type === 'theta' ? 144 : type === 'alpha' ? 150 : 180;
      const beatFreq = rightFreq - 140;
      synthNodesRef.current.osc2.frequency.setValueAtTime(rightFreq, audioCtxRef.current.currentTime);
      onTriggerNotification(
        "Binaural Shifted",
        `Synthesizer updated to ${beatFreq}Hz ${type.charAt(0).toUpperCase() + type.slice(1)} wave beat.`,
        "info"
      );
    }
  };

  // Fetch AI Workflow
  useEffect(() => {
    async function loadWorkflow() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/generate-workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            title: task.title,
            description: task.description,
            duration: task.duration,
            priority: task.priority,
            period: task.period,
            model,
            bypassAI,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate custom workflow from AI");
        }

        const data = await response.json();
        setWorkflow(data);
        if (data.isFallback && onAddFallbackWarning) {
          onAddFallbackWarning(
            'gemini',
            'Workflow Generator Offline Fallback',
            `Could not reach Google AI Studio to generate steps for "${task.title}". Loaded local templates.`
          );
          onTriggerNotification(
            "Workflow Fallback",
            "Loaded offline template steps for your task focus.",
            "warning"
          );
        }
        if (data.tokenUsage) {
          onAddTokens(data.tokenUsage.totalTokens || 0);
        }
      } catch (err: any) {
        console.error("Error generating workflow:", err);
        setError(err.message || "Something went wrong generating your workflow.");
      } finally {
        setLoading(false);
      }
    }

    loadWorkflow();
    // Reset timer to task duration on load
    setTimeLeft(task.duration * 60);
    setTimerRunning(false);
    setCompletedSteps([]);
    setTimerPreset('task');
  }, [task]);

  // Handle Timer Ticks
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
      onTriggerNotification(
        "Timer Completed!",
        `Congratulations, you completed your session for "${task.title}"!`,
        "success"
      );
      playNotificationSound();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timeLeft]);

  // Audio Notification Beep
  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("Could not play notification sound", e);
    }
  };

  // Focus Binaural Synthesizer
  const toggleSynthesizer = () => {
    if (isSynthPlaying) {
      // Stop
      if (synthNodesRef.current) {
        try {
          synthNodesRef.current.osc1.stop();
          synthNodesRef.current.osc2.stop();
        } catch (e) {}
        synthNodesRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
          audioCtxRef.current = null;
      }
      setIsSynthPlaying(false);
    } else {
      // Start real low-frequency binaural focus hum
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.value = 140; // 140Hz left carrier

        const rightFreq = binauralType === 'theta' ? 144 : binauralType === 'alpha' ? 150 : 180;
        const beatFreq = rightFreq - 140;

        osc2.type = "sine";
        osc2.frequency.value = rightFreq;

        // Low volume focus pad
        gainNode.gain.value = 0.04;

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();

        synthNodesRef.current = { osc1, osc2, gainNode };
        setIsSynthPlaying(true);
        onTriggerNotification(
          "Binaural Soundscape Active",
          `A soft ${beatFreq}Hz ${binauralType.charAt(0).toUpperCase() + binauralType.slice(1)} wave binaural beat is synthesizing to aid focus.`,
          "info"
        );
      } catch (e) {
        console.warn("Binaural Synthesizer failed to start", e);
      }
    }
  };

  // Clean up synth on unmount
  useEffect(() => {
    return () => {
      if (synthNodesRef.current) {
        try {
          synthNodesRef.current.osc1.stop();
          synthNodesRef.current.osc2.stop();
        } catch (e) {}
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handlePresetChange = (preset: 'task' | 'pomodoro' | 'shortBreak') => {
    setTimerPreset(preset);
    setTimerRunning(false);
    if (preset === 'task') {
      setTimeLeft(task.duration * 60);
    } else if (preset === 'pomodoro') {
      setTimeLeft(25 * 60);
    } else if (preset === 'shortBreak') {
      setTimeLeft(5 * 60);
    }
  };

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const isCompleted = prev.includes(stepId);
      const nextSteps = isCompleted ? prev.filter((id) => id !== stepId) : [...prev, stepId];
      
      // If we completed the final step, notify!
      if (!isCompleted && workflow && nextSteps.length === workflow.steps.length) {
        onTriggerNotification(
          "All Steps Completed!",
          `Amazing work! You've checked off every micro-step for "${task.title}".`,
          "success"
        );
      }
      return nextSteps;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-nature-950 border-l border-nature-200 dark:border-nature-800 w-full" id="workflow-panel">
      {/* Panel Header */}
      <div className="p-5 border-b border-nature-200 dark:border-nature-800 flex items-center justify-between bg-white dark:bg-nature-950">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-sage-600 dark:text-sage-450 font-mono">
            Focus Workflow
          </span>
          <h2 className="text-sm font-bold text-nature-950 dark:text-white truncate max-w-[240px] mt-0.5">
            {task.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-nature-450 dark:text-nature-400 hover:text-nature-800 dark:hover:text-nature-200 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors cursor-pointer"
          id="close-workflow-panel-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 lg:overflow-y-auto overflow-visible p-5 space-y-6" id="workflow-panel-content">
        {/* TIMER SECTION */}
        <div className="bg-nature-50 dark:bg-nature-900 rounded-2xl border border-nature-200 dark:border-nature-800 p-5 flex flex-col items-center">
          {/* Preset Buttons */}
          <div className="flex bg-nature-200/60 dark:bg-nature-950 p-1 rounded-xl border border-nature-300/40 dark:border-nature-850 mb-5">
            <button
              onClick={() => handlePresetChange('task')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                timerPreset === 'task'
                  ? "bg-sage-600 text-white shadow-xs"
                  : "text-nature-600 dark:text-nature-400 hover:text-nature-900 dark:hover:text-white"
              }`}
            >
              Task ({task.duration}m)
            </button>
            <button
              onClick={() => handlePresetChange('pomodoro')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                timerPreset === 'pomodoro'
                  ? "bg-sage-600 text-white shadow-xs"
                  : "text-nature-600 dark:text-nature-400 hover:text-nature-900 dark:hover:text-white"
              }`}
            >
              Pomodoro (25m)
            </button>
            <button
              onClick={() => handlePresetChange('shortBreak')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                timerPreset === 'shortBreak'
                  ? "bg-sage-600 text-white shadow-xs"
                  : "text-nature-600 dark:text-nature-400 hover:text-nature-900 dark:hover:text-white"
              }`}
            >
              Break (5m)
            </button>
          </div>

          {/* Time Countdown */}
          <div className="text-4xl md:text-5xl font-extrabold text-nature-850 dark:text-nature-50 tracking-wider font-mono select-none">
            {formatTime(timeLeft)}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className={`p-3 rounded-full transition-all duration-200 shadow-xl cursor-pointer ${
                timerRunning
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-sage-600 hover:bg-sage-700 text-white hover:scale-105 active:scale-95"
              }`}
              title={timerRunning ? "Pause timer" : "Start timer"}
            >
              {timerRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => {
                setTimerRunning(false);
                handlePresetChange(timerPreset);
              }}
              className="p-3 rounded-full bg-white dark:bg-nature-900 hover:bg-nature-100 dark:hover:bg-nature-800 text-nature-600 dark:text-nature-300 border border-nature-200 dark:border-nature-800 transition-colors cursor-pointer"
              title="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Synthesized Binaural Deck */}
          <div className="w-full border-t border-nature-200 dark:border-nature-800 mt-5 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                  <Music className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-bold text-nature-800 dark:text-nature-150 capitalize">
                    {binauralType} Wave ({binauralType === 'theta' ? '4Hz' : binauralType === 'alpha' ? '10Hz' : '40Hz'})
                  </div>
                  <div className="text-[9px] text-nature-500 dark:text-nature-400">
                    {binauralType === 'theta' 
                      ? "Stimulate peak flow state & visualization" 
                      : binauralType === 'alpha' 
                      ? "Active relaxation & calm learning focus" 
                      : "Peak problem solving & cognitive load"}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleSynthesizer}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                  isSynthPlaying
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60"
                    : "bg-white dark:bg-nature-900 hover:bg-nature-100 dark:hover:bg-nature-800 text-nature-600 dark:text-nature-300 border-nature-250 dark:border-nature-800"
                }`}
              >
                {isSynthPlaying ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 animate-bounce text-emerald-600" />
                    <span>Synthesizing</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Play Wave</span>
                  </>
                )}
              </button>
            </div>

            {/* Sound Wave Options */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(['theta', 'alpha', 'gamma'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleBinauralTypeChange(type)}
                  className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer text-center capitalize ${
                    binauralType === type
                      ? "bg-sage-600 border-sage-500 text-white shadow-sm"
                      : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-700 text-nature-600 dark:text-nature-300 hover:text-nature-900 dark:hover:text-white"
                  }`}
                >
                  {type} Wave
                </button>
              ))}
            </div>

            {/* Binaural Audio Visualizer */}
            {isSynthPlaying && (
              <div className="flex items-end justify-center gap-1.5 h-8 w-full mt-3 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 dark:border-emerald-950/40 rounded-xl p-2 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((bar) => {
                  const delay = (bar * 0.04).toFixed(2);
                  const duration = (0.5 + Math.random() * 0.5).toFixed(2);
                  return (
                    <div
                      key={bar}
                      className="w-1 bg-gradient-to-t from-emerald-500/80 to-sage-500 rounded-t animate-sound-bar"
                      style={{
                        animationDelay: `${delay}s`,
                        animationDuration: `${duration}s`,
                        height: '100%',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3 bg-nature-50/20 dark:bg-nature-900/20 border border-nature-200 dark:border-nature-800 border-dashed rounded-xl">
            <Loader2 className="w-8 h-8 text-sage-600 animate-spin" />
            <div className="text-sm text-nature-800 dark:text-nature-200 font-medium">Deconstructing task...</div>
            <p className="text-xs text-nature-500 dark:text-nature-400 max-w-xs leading-relaxed px-4">
              Gemini is designing a structured blueprint and anticipating focus roadblocks to make your work effortless.
            </p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-150 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-700 dark:text-rose-400">Could not generate workflow</p>
              <p className="mt-1 opacity-90">{error}</p>
              <button
                onClick={() => setWorkflow(null)}
                className="mt-2 text-sage-600 dark:text-sage-400 hover:text-sage-700 underline font-semibold block"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* AI WORKFLOW BLUEPRINT */}
        {workflow && (
          <div className="space-y-6" id="loaded-workflow-blueprint">
            {/* Steps Checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600 animate-pulse" />
                <h3 className="text-xs font-bold text-nature-950 dark:text-white uppercase tracking-wider font-mono">
                  Micro-Step Checklist
                </h3>
              </div>

              <div className="space-y-3">
                {workflow.steps.map((step, index) => {
                  const isChecked = completedSteps.includes(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isChecked
                          ? "bg-emerald-50/20 dark:bg-emerald-950/15 border-emerald-150 dark:border-emerald-900/30 opacity-80"
                          : "bg-white dark:bg-nature-900 border-nature-200 dark:border-nature-800 hover:border-nature-300 dark:hover:border-nature-750 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleStep(step.id)}
                          className={`mt-0.5 p-1 rounded-md border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-450"
                              : "border-nature-300 dark:border-nature-700 text-nature-400 dark:text-nature-500 hover:border-nature-650 dark:hover:border-nature-400"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4
                              className={`text-sm font-bold leading-snug ${
                                isChecked ? "line-through text-nature-400 dark:text-nature-500" : "text-nature-950 dark:text-white"
                              }`}
                            >
                              {index + 1}. {step.title}
                            </h4>
                            <span className="text-[10px] font-mono font-bold bg-nature-100 dark:bg-nature-800 text-nature-600 dark:text-nature-300 px-1.5 py-0.5 rounded shrink-0">
                              {step.duration}m
                            </span>
                          </div>
                          <p className={`text-xs mt-1.5 leading-relaxed font-medium ${
                            isChecked ? "text-nature-400 dark:text-nature-500" : "text-nature-700 dark:text-nature-300"
                          }`}>
                            {step.description}
                          </p>

                          {step.tips && step.tips.length > 0 && (
                            <div className="mt-3 bg-sage-50/50 dark:bg-nature-950/50 rounded-lg p-3 border border-sage-100 dark:border-nature-800/80">
                              <div className="text-[10px] font-bold text-sage-600 dark:text-sage-400 uppercase tracking-wider font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-sage-500" /> Peak Tip:
                              </div>
                              <ul className="list-none mt-1.5 space-y-1">
                                {step.tips.map((tip, tIdx) => (
                                  <li key={tIdx} className="text-xs font-medium text-nature-800 dark:text-nature-200 leading-relaxed flex items-start gap-1.5">
                                    <span className="text-sage-500 dark:text-sage-400 select-none shrink-0 text-sm leading-none">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ROADBLOCK BUSTER */}
            {workflow.roadblocks && workflow.roadblocks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-sage-500" />
                  <h3 className="text-xs font-bold text-nature-950 dark:text-white uppercase tracking-wider font-mono">
                    Roadblock Buster
                  </h3>
                </div>

                <div className="space-y-2">
                  {workflow.roadblocks.map((rb, idx) => (
                    <div
                      key={idx}
                      className="border border-nature-200 dark:border-nature-800 bg-white dark:bg-nature-900 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setActiveRoadblock(activeRoadblock === idx ? null : idx)}
                        className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs font-semibold text-nature-700 dark:text-nature-250 hover:bg-nature-50 dark:hover:bg-nature-950 transition-colors cursor-pointer"
                      >
                        <span className="truncate">{rb.obstacle}</span>
                        <span className="text-sage-600 dark:text-sage-450 text-xs shrink-0 font-mono">
                          {activeRoadblock === idx ? "Collapse" : "Resolve"}
                        </span>
                      </button>
                      
                      <AnimatePresence>
                        {activeRoadblock === idx && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3.5 bg-nature-50 dark:bg-nature-950 border-t border-nature-200 dark:border-nature-800 text-[11px] text-nature-600 dark:text-nature-300 leading-relaxed">
                              <span className="font-semibold text-sage-700 dark:text-sage-450 block mb-1">Coach Strategy:</span>
                              {rb.solution}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PSYCHOLOGICAL FOCUS TIPS */}
            {workflow.focusTips && workflow.focusTips.length > 0 && (
              <div className="p-4 rounded-xl bg-sage-50 dark:bg-sage-950/45 border border-sage-100 dark:border-sage-850">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                  <h4 className="text-[10px] font-bold text-sage-700 dark:text-sage-300 uppercase tracking-wider font-mono">
                    Session Focus Triggers
                  </h4>
                </div>
                <ul className="space-y-2">
                  {workflow.focusTips.map((tip, idx) => (
                    <li key={idx} className="text-[11px] text-nature-700 dark:text-nature-300 flex items-start gap-1.5">
                      <span className="text-sage-600 shrink-0 font-mono font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Panel Footer */}
      {!task.completed && (
        <div className="p-4 border-t border-nature-200 dark:border-nature-800 bg-white dark:bg-nature-950 shrink-0 flex items-center justify-center">
          <button
            onClick={() => {
              onCompleteTask(task.id);
              onClose();
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>Complete Task & Finish Session</span>
          </button>
        </div>
      )}
    </div>
  );
}
