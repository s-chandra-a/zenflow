import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { initDB, getTasks, syncTasks, getHabits, syncHabits, getDBStatus, updateMongoURI, getSettings, syncSettings } from "./db";


// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with generous limits for file content
app.use(express.json({ limit: "10mb" }));

// Lazy init GoogleGenAI
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// Robust helper to execute Gemini generateContent with auto-retries and timeouts
async function generateContentWithRetry(options: {
  model: string;
  contents: string;
  config?: any;
}, maxRetries = 3, initialDelayMs = 1500): Promise<any> {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Race the API call with a 25-second timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: Gemini API took too long to respond")), 25000)
      );

      const ai = getAI();
      const response = await Promise.race([
        ai.models.generateContent(options),
        timeoutPromise
      ]);

      return response;
    } catch (err: any) {
      const status = err?.status || err?.statusCode || err?.error?.code || 0;
      const message = err?.message || "";
      const isRateLimit = status === 429 || message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED") || message.includes("limit");
      const isServerError = status === 503 || status === 500 || message.includes("503") || message.includes("500") || message.includes("UNAVAILABLE") || message.includes("demand");
      const isTimeout = message.includes("Timeout") || message.includes("fetch failed") || message.includes("abort") || message.includes("undici");

      const shouldRetry = (isRateLimit || isServerError || isTimeout) && attempt < maxRetries;

      if (!shouldRetry) {
        throw err;
      }

      console.warn(`Gemini API call failed (attempt ${attempt}/${maxRetries}): ${message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // exponential backoff
    }
  }
}

// Safely parses JSON by stripping potential markdown formatting blocks and trailing/leading noise
function parseSafeJSON(text: string): any {
  let cleaned = text.trim();
  
  // Remove starting markdown block formatting if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7).trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3).trim();
  }
  
  // Remove ending markdown block formatting if present
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }

  // Find the outermost brace or bracket to isolate the JSON block if any extra text was added around it
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned);
}

// Tasks API Endpoints
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await getTasks();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch tasks" });
  }
});

app.post("/api/tasks/sync", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: "tasks must be an array" });
    }
    await syncTasks(tasks);
    res.json({ success: true, count: tasks.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to sync tasks" });
  }
});

// Habits API Endpoints
app.get("/api/habits", async (req, res) => {
  try {
    const habits = await getHabits();
    res.json(habits);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch habits" });
  }
});

app.post("/api/habits/sync", async (req, res) => {
  try {
    const { habits } = req.body;
    if (!Array.isArray(habits)) {
      return res.status(400).json({ error: "habits must be an array" });
    }
    await syncHabits(habits);
    res.json({ success: true, count: habits.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to sync habits" });
  }
});

// Settings & Preferences API Endpoints
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch settings" });
  }
});

app.post("/api/settings/sync", async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: "settings object is required" });
    }
    await syncSettings(settings);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to sync settings" });
  }
});

// DB API Endpoints
app.get("/api/db-status", (req, res) => {
  try {
    const status = getDBStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch DB status" });
  }
});

app.post("/api/db-config", async (req, res) => {
  try {
    const { uri } = req.body;
    if (typeof uri !== "string") {
      return res.status(400).json({ error: "uri must be a string" });
    }
    const result = await updateMongoURI(uri);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update DB config" });
  }
});

// API Endpoint to check Google AI Studio Gemini API Key Status and Rate Limits
app.get("/api/genai-status", (req, res) => {
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  res.json({
    status: "ok",
    hasApiKey: hasKey,
    limits: {
      rpm: 15,
      tpm: 1000000,
      rpd: 1500
    },
    tier: "free",
    model: "gemini-2.5-flash"
  });
});

app.get("/api/models", async (req, res) => {
  try {
    const ai = getAI();
    const response = await ai.models.list();
    const modelsList = [];
    for await (const m of response) {
      modelsList.push(m);
    }
    
    // Filter models to keep only those starting with gemini- and map them
    const textModels = modelsList
      .filter((m: any) => m.name.startsWith("models/gemini-") || m.name.startsWith("gemini-"))
      .map((m: any) => {
        const simpleName = m.name.replace(/^models\//, "");
        return {
          name: simpleName,
          displayName: m.displayName || simpleName,
          description: m.description || ""
        };
      });
      
    res.json({ models: textModels });
  } catch (error: any) {
    console.warn("Could not list models from Gemini API, returning fallback list:", error.message || error);
    res.json({
      models: [
        { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
        { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
        { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
        { name: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash" },
        { name: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
        { name: "gemini-1.0-pro", displayName: "Gemini 1.0 Pro" }
      ],
      isFallback: true
    });
  }
});

// API Endpoint to check AI API status
app.get("/api/ai-status", (req, res) => {
  const hasKey = !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY;
  res.json({
    status: hasKey ? "active" : "fallback",
    provider: process.env.GOOGLE_API_KEY ? "Google Cloud Studio" : process.env.GEMINI_API_KEY ? "Gemini API Link" : "Local Algorithm Fallback"
  });
});

// API Endpoint to parse text into structured tasks
app.post("/api/parse-tasks", async (req, res) => {
  try {
    const { text, model, bypassAI } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required to parse tasks" });
    }

    try {
      if (bypassAI) {
        throw new Error("AI bypassed: quota limit exceeded");
      }
      const ai = getAI();
      const prompt = `You are an expert personal productivity assistant. Analyze the user's text describing all the things they want to do today and tomorrow. 
Parse this text into a structured list of tasks.

For each task, provide:
- "title": a concise summary of the task.
- "description": details or notes from the text regarding this task.
- "duration": estimated minutes to complete (defaults to 30 if unspecified).
- "priority": 'low', 'medium', or 'high' based on urgency or explicit user instruction.
- "period": 'today' or 'tomorrow' based on the text. If not specified, default to 'today'.
- "category": 'work', 'personal', 'health', 'learning', or 'other'.
- "timeOfDay": estimated time or period of day (e.g. "9:00 AM", "Morning", "Afternoon", "Evening", "Anytime").
- "scheduledTime": an optional string representing the exact start time in 24-hour HH:MM format (e.g., "14:00", "09:30") if a specific time is mentioned in the user's text. If no specific time is mentioned, set it to null.
- "timeFrozen": a boolean (true or false). Set to true ONLY if a specific exact start time is explicitly mentioned in the user's text (e.g. "at 2 PM", "at 10:30 AM"). Otherwise, set it to false.

User text:
"""
${text}
"""

Return a single JSON object with a "tasks" array containing the parsed tasks. Do not include any explanation or markdown tags outside the JSON.`;

      const response = await generateContentWithRetry({
        model: model || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      const tokenUsage = {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      };

      const resultText = response.text || "{}";
      const resultJson = parseSafeJSON(resultText);
      res.json({ ...resultJson, tokenUsage });
    } catch (apiError: any) {
      console.warn("Gemini API error in /api/parse-tasks, falling back to local extraction:", apiError);
      const fallbackResult = parseLocalTasks(text);
      res.json({ ...fallbackResult, isFallback: true, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    }
  } catch (error: any) {
    console.error("Critical error in /api/parse-tasks:", error);
    res.status(500).json({ error: error.message || "Failed to parse tasks" });
  }
});

// API Endpoint to generate detailed interactive workflow for a specific task
app.post("/api/generate-workflow", async (req, res) => {
  try {
    const { taskId, title, description, duration, priority, period, model, bypassAI } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Task title is required" });
    }

    try {
      if (bypassAI) {
        throw new Error("AI bypassed: quota limit exceeded");
      }
      const ai = getAI();
      const prompt = `You are a peak-performance coach and productivity strategist. For the task below, design a highly actionable step-by-step interactive workflow/guide to help the user execute it flawlessly and easily.

Task details:
- Title: ${title}
- Description: ${description || "None provided"}
- Estimated Duration: ${duration || 30} minutes
- Priority: ${priority || "medium"}
- Period: ${period || "today"}

Please generate a JSON object with:
1. "steps": An array of micro-steps to execute this task. Each step must have:
   - "id": a unique string ID (e.g., "step-1")
   - "title": a clear, action-oriented step title (e.g. "Gather materials", "Eliminate distractions")
   - "description": extremely concise action-oriented guidance (exactly 1 short sentence, under 18 words)
   - "duration": estimated minutes for this specific step (the sum of step durations should roughly match the total task duration)
   - "tips": 1-2 ultra-concise bullet tips for this step (keep under 10 words each)
2. "roadblocks": An array of typical procrastination pitfalls or focus barriers for this task, each with:
   - "obstacle": description of the barrier
   - "solution": highly actionable, short coach advice to overcome it
3. "focusTips": 2-3 highly concise psychological focus tips tailored to this exact kind of task (keep under 15 words each).
4. "playlistMood": A recommended music/ambient sound theme (e.g., "Binaural Focus Beats", "Deep Forest Rain", "Warm Cozy Lofi Coffee Shop").

Return only a valid JSON matching this schema. No explanation or markdown tags.`;

      const response = await generateContentWithRetry({
        model: model || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      const tokenUsage = {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      };

      const resultText = response.text || "{}";
      const resultJson = parseSafeJSON(resultText);
      res.json({ taskId, ...resultJson, tokenUsage });
    } catch (apiError: any) {
      console.warn("Gemini API error in /api/generate-workflow, falling back to local workflow generation:", apiError);
      const fallbackResult = getLocalWorkflow(taskId, title, description, duration, priority, period);
      res.json({ ...fallbackResult, isFallback: true, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    }
  } catch (error: any) {
    console.error("Critical error in /api/generate-workflow:", error);
    res.status(500).json({ error: error.message || "Failed to generate workflow" });
  }
});

// API Endpoint to analyze and auto-prioritize tasks based on context
app.post("/api/ai-scheduler", async (req, res) => {
  try {
    const { tasks, habits, currentTime, period, options, model, bypassAI } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Tasks array is required to schedule" });
    }

    if (tasks.length === 0) {
      return res.json({ scheduledTasks: [], newBreaks: [], tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    }

    const includeBreaks = options?.includeBreaks ?? true;
    const mixCategories = options?.mixCategories ?? false;
    const context = options?.context ?? "";
    const mindHabits = options?.mindHabits ?? false;

    // Helper to calculate time in minutes
    const timeToMin = (tStr: string): number => {
      if (!tStr) return 480;
      const parts = tStr.split(":");
      if (parts.length < 2) return 480;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const scheduleStartTime = period === "tomorrow" ? "08:00" : (currentTime || "08:00");
    const currentMinVal = timeToMin(scheduleStartTime);

    // Partition tasks:
    // 1. Completed tasks scheduled before currentTime (kept as is)
    // 2. Completed tasks scheduled after (or equal to) currentTime or without scheduled time (jammed before currentTime)
    // 3. Incompleted tasks (to be scheduled normally)
    const completedTasksBefore = tasks.filter(t => t.completed && t.scheduledTime && timeToMin(t.scheduledTime) < currentMinVal);
    const completedTasksToJam = tasks.filter(t => t.completed && (!t.scheduledTime || timeToMin(t.scheduledTime) >= currentMinVal));
    const remainingToSchedule = tasks.filter(t => !t.completed);

    // Jam completed tasks scheduled after current time just before current time
    let endMin = currentMinVal;
    const jammedTasks: any[] = [];
    for (let i = completedTasksToJam.length - 1; i >= 0; i--) {
      const task = completedTasksToJam[i];
      const startMin = endMin - task.duration;
      const sh = Math.floor(startMin / 60);
      const sm = startMin % 60;
      const adjustedHour = ((sh % 24) + 24) % 24;
      const adjustedMin = ((sm % 60) + 60) % 60;
      const timeStr = `${adjustedHour.toString().padStart(2, "0")}:${adjustedMin.toString().padStart(2, "0")}`;
      
      jammedTasks.unshift({
        id: task.id,
        scheduledTime: timeStr,
        priority: task.priority,
        period: task.period,
        timeFrozen: true
      });
      endMin = startMin;
    }

    const preProcessedScheduledTasks = [
      ...completedTasksBefore.map(t => ({
        id: t.id,
        scheduledTime: t.scheduledTime,
        priority: t.priority,
        period: t.period,
        timeFrozen: true
      })),
      ...jammedTasks
    ];

    // If there are no incompleted tasks left, return pre-scheduled completed tasks immediately
    if (remainingToSchedule.length === 0) {
      return res.json({
        scheduledTasks: preProcessedScheduledTasks,
        newBreaks: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      });
    }

    try {
      if (bypassAI) {
        throw new Error("AI bypassed: quota limit exceeded");
      }
      const ai = getAI();
      const targetDayText = period === "tomorrow" ? "tomorrow" : "today";
      const overflowGuideline = period === "tomorrow"
        ? `3. NO OVERFLOW DISPLACEMENT (CRITICAL):
   - You MUST schedule ALL tasks regardless of whether they extend past 11:00 PM. Do NOT set any task's period to "overflow". Keep their period as "tomorrow" and assign them valid times.`
        : `3. OVERFLOW & TIMELINE CONSTRAINT:
   - Try to fit all tasks in today's timeline (between the starting time of ${scheduleStartTime} and 11:00 PM).
   - If the task durations and required gaps overflow the remaining time today (meaning they extend past 11:00 PM), you MUST NOT schedule them on the timeline. Instead, flag them by setting "period": "overflow" and leaving "scheduledTime": null (or blank).
   - For tasks that fit in today's timeline, set "period": "today".`;

      const prompt = `You are an elite productivity planner and calendar scheduling engine.
Your goal is to schedule the user's tasks starting from ${scheduleStartTime} and finishing by 11:00 PM (23:00) ${targetDayText}.

Input Tasks to schedule:
${JSON.stringify(remainingToSchedule.map(t => ({ id: t.id, title: t.title, description: t.description || "", duration: t.duration, priority: t.priority, category: t.category || "work", scheduledTime: t.scheduledTime, timeFrozen: t.timeFrozen || false })), null, 2)}

Completed/Locked Tasks already scheduled (Do NOT schedule any tasks during these times. Keep these slots blank to leave gaps for these tasks):
${JSON.stringify(preProcessedScheduledTasks.map(pt => {
  const original = tasks.find(ot => ot.id === pt.id);
  return {
    title: original?.title || "Completed Task",
    time: pt.scheduledTime,
    duration: original?.duration || 30
  };
}), null, 2)}

User's Habits (${mindHabits ? "CRITICAL: Do NOT schedule any tasks during these habit times. Keep these slots blank to leave gaps for these habits" : "You can ignore these habit times when scheduling tasks"}):
${JSON.stringify((habits || []).filter((h: any) => h.enabled).map((h: any) => ({ title: h.title, time: h.time, duration: h.duration })), null, 2)}

Scheduling Guidelines:
1. TASK DURATION AWARENESS (CRITICAL):
   - You MUST ensure tasks do NOT overlap in time.
   - For example, if a task starts at 09:00 and its duration is 180 minutes (3 hours), the next scheduled task can start no earlier than 12:00. Use their "duration" (in minutes) to calculate subsequent start times accurately.
2. SCHEDULER OPTIONS, BREAKS & HABITS:
   - Mind habits: ${mindHabits ? "YES (CRITICAL). Do NOT schedule any tasks that overlap with the active habit times listed above. Keep those times free on the calendar view." : "NO. You can schedule tasks at these times."}
   - Include breaks / gaps: ${includeBreaks ? "YES. You MUST ensure that you NEVER schedule consecutive tasks without a blank space in between. Leave a blank gap of at least 30 minutes between EVERY consecutive pair of tasks. E.g. if Task 1 ends at 10:00, Task 2 can start no earlier than 10:30." : "NO. Schedule tasks back-to-back where possible (except when avoiding habit times)."}
   - No dummy break tasks: Do NOT output any "Break & stretch" or dummy filler tasks. Just leave those slots empty on the calendar by adjusting the tasks' "scheduledTime" values.
   - Mix categories: ${mixCategories ? "YES. Try to alternate tasks between different categories (e.g., mix work, personal, study, health) rather than grouping all tasks of the same category together." : "NO. You can group similar category tasks together."}
   - User custom context: ${context || "None provided."}
${overflowGuideline}
4. CALENDAR CONSTRAINTS:
   - Assign each successfully scheduled task a valid 'scheduledTime' in 24-hour format "HH:MM" (e.g. "09:30", "14:15", "18:00").
   - Reschedule tasks to make the day productive. Adjust their priorities ('high', 'medium', 'low') based on their urgency.
5. TIME-FROZEN TASKS (CRITICAL CONSTRAINT):
   - Any input task marked with "timeFrozen": true MUST remain scheduled at its pre-existing "scheduledTime" (HH:MM). You MUST NOT shift its start time or duration or modify its period.
   - In addition to habits, you MUST NOT schedule any tasks that overlap with the Completed/Locked Tasks listed above. You MUST schedule all other tasks *around* these times to avoid timeline overlaps.
6. USER PREFERENCES & TASK RETIMING/FREEZING (CRITICAL):
   - You MUST analyze the "User custom context" above for specific scheduling preferences, constraints, retimings, or locking requests:
     a) Task Identification & Matching:
        - Identify individual tasks by name/title (e.g. "task-1", "Task-2"). Use case-insensitive and partial title matches.
        - Semantic Group/Category Matching: Identify groups of tasks referred to collectively by topic, category, class type, tag, or semantic synonyms (e.g. "all [X] related tasks", "all [Y] classes", or "all [Z] tasks").
        - Match these groups dynamically by checking task categories, or scanning titles and descriptions for words and synonyms related to the user's mentioned topic or theme.
     b) Freezing Tasks & Groups:
        - If the user requests to freeze or lock a task or a group of tasks (e.g. "Freeze [Task Name] at [Time]", "Freeze all [Topic] tasks"), schedule those tasks at the exact requested times (converting 12-hour values like 7pm or 5pm to 24-hour HH:MM format e.g. "19:00" or "17:00") and set "timeFrozen": true in the output.
     c) Time Spans / Ranges:
        - If the user states a task or group runs from a start to end time (e.g. "[Task Name] is from [Time A] to [Time B]"), schedule them at the start of that window, set "timeFrozen": true, and ensure other tasks do not overlap with this time window.
     d) Retiming Categories/Groups:
        - If the user requests to retime all tasks of a group (e.g. "Retime all [Topic] tasks between [Time A] to [Time B]"), identify ALL matching tasks using the Semantic Group Matching logic above and schedule them inside that specified time slot, adjusting start times to respect task durations without overlapping. Set "timeFrozen": true for all of them to lock them at these new positions.
7. INTEGRITY & NO DELETIONS/EDITS (CRITICAL RULE):
   - You MUST NOT create new tasks, and you MUST NOT delete or omit any of the input tasks. Every task in the "Input Tasks to schedule" list must be returned in the "scheduledTasks" array with its original "id".
   - You MUST NOT edit or modify the core properties of the tasks (such as title, description, category, or duration). You are ONLY allowed to assign/update "scheduledTime", "priority", "period", and "timeFrozen".

Return a JSON object containing a "scheduledTasks" array and an empty "newBreaks" array.
Return ONLY a valid JSON object matching this structure:
{
  "scheduledTasks": [
    { "id": "...", "scheduledTime": "HH:MM|null", "priority": "high|medium|low", "period": "${period === 'tomorrow' ? 'tomorrow' : 'today|overflow'}", "timeFrozen": true|false },
    ...
  ],
  "newBreaks": []
}
Do not include any explanation or markdown outside the JSON.`;

      const response = await generateContentWithRetry({
        model: model || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      const tokenUsage = {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      };

      const resultText = response.text || "{}";
      const resultJson = parseSafeJSON(resultText);
      const mergedScheduledTasks = [
        ...preProcessedScheduledTasks,
        ...(resultJson.scheduledTasks || [])
      ];
      res.json({ ...resultJson, scheduledTasks: mergedScheduledTasks, tokenUsage });
    } catch (apiError: any) {
      console.warn("Gemini API error in /api/ai-scheduler, falling back to local scheduling:", apiError);
      const fallbackTasks = [
        ...preProcessedScheduledTasks.map(pt => {
          const ot = tasks.find(o => o.id === pt.id);
          return { ...ot, ...pt };
        }),
        ...remainingToSchedule
      ];
      const fallbackResult = getLocalScheduling(fallbackTasks, habits || [], options);
      res.json({ ...fallbackResult, isFallback: true, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    }
  } catch (error: any) {
    console.error("Critical error in /api/ai-scheduler:", error);
    res.status(500).json({ error: error.message || "Failed to schedule tasks" });
  }
});

// API Endpoint to generate detailed productivity retrospective summary
app.post("/api/generate-summary", async (req, res) => {
  try {
    const { tasks, model, bypassAI } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Tasks are required to generate summary" });
    }

    try {
      if (bypassAI) {
        throw new Error("AI bypassed: quota limit exceeded");
      }
      const ai = getAI();
      const completedTasks = tasks.filter(t => t.completed);
      const pendingTasks = tasks.filter(t => !t.completed);

      const prompt = `You are an encouraging peak-performance executive coach.
Summarize the user's productivity accomplishments for yesterday based on this list of tasks:

Completed Tasks:
${JSON.stringify(completedTasks, null, 2)}

Pending/Incomplete Tasks:
${JSON.stringify(pendingTasks, null, 2)}

Please write:
1. A warm, empowering, and extremely concise 1-2 sentence overview of what they accomplished. Keep it short, focused, and punchy.
2. A list of 2-3 brief, highly actionable recommendations (carry over momentum or address gaps) - keep each recommendation under 15 words.
3. A brief "Mantra of the Day" (under 10 words).

Return ONLY a JSON object with this exact structure:
{
  "overview": "...",
  "recommendations": ["...", "..."],
  "mantra": "..."
}
Do not include any explanation or markdown outside the JSON.`;

      const response = await generateContentWithRetry({
        model: model || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      const tokenUsage = {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      };

      const resultText = response.text || "{}";
      const resultJson = parseSafeJSON(resultText);
      res.json({ ...resultJson, tokenUsage });
    } catch (apiError: any) {
      console.warn("Gemini API error in /api/generate-summary, falling back to local summary:", apiError);
      const fallbackResult = getLocalSummary(tasks);
      res.json({ ...fallbackResult, isFallback: true, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    }
  } catch (error: any) {
    console.error("Critical error in /api/generate-summary:", error);
    res.status(500).json({ error: error.message || "Failed to generate summary" });
  }
});

// LOCAL RULE-BASED FALLBACK GENERATOR UTILITIES
function parseLocalTasks(text: string) {
  const lines = text.split(/\r?\n/);
  const tasks: any[] = [];
  let idCounter = Date.now();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.length < 4 || (line.endsWith(":") && !line.includes("at") && !line.includes("am") && !line.includes("pm"))) {
      continue;
    }

    let title = line.replace(/^[-*•\d.+\][]+\s*(?:\[\s*[ xX]?\s*\])?\s*/, '').trim();
    if (!title) continue;

    let duration = 30;
    const durationMatch = title.match(/(?:for\s+)?(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      if (unit.startsWith('h')) {
        duration = num * 60;
      } else {
        duration = num;
      }
      title = title.replace(durationMatch[0], '').trim();
    }

    let period: 'today' | 'tomorrow' = 'today';
    if (/\b(tomorrow|tmrw|nxt day)\b/i.test(line)) {
      period = 'tomorrow';
    }

    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (/\b(urgent|asap|critical|must|important|priority|deadline|high)\b/i.test(line)) {
      priority = 'high';
    } else if (/\b(casual|someday|optional|low|chore|routine|maybe)\b/i.test(line)) {
      priority = 'low';
    }

    let category: 'work' | 'personal' | 'health' | 'learning' | 'other' = 'other';
    const textLower = line.toLowerCase();
    if (/\b(code|meeting|work|client|api|project|database|invoice|job|interview|sync)\b/i.test(textLower)) {
      category = 'work';
    } else if (/\b(study|read|learn|book|course|tutorial|research|lecture|class|quiz)\b/i.test(textLower)) {
      category = 'learning';
    } else if (/\b(gym|workout|run|meditate|stretch|exercise|run|health|walk|doctor|meds)\b/i.test(textLower)) {
      category = 'health';
    } else if (/\b(grocery|clean|shop|buy|call|family|laundry|dishes|tidy|apartment|personal)\b/i.test(textLower)) {
      category = 'personal';
    }

    title = title.replace(/[,.;:]+$/, '').trim();

    let timeOfDay = "Anytime";
    const timeMatch = line.match(/\b((?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:am|pm|AM|PM))\b/);
    if (timeMatch) {
      timeOfDay = timeMatch[1];
    } else if (/\b(morning|morn)\b/i.test(line)) {
      timeOfDay = "Morning";
    } else if (/\b(afternoon|noon)\b/i.test(line)) {
      timeOfDay = "Afternoon";
    } else if (/\b(evening|night)\b/i.test(line)) {
      timeOfDay = "Evening";
    }

    tasks.push({
      id: `task-parsed-${idCounter++}`,
      title,
      description: `Locally extracted task from text input.`,
      duration,
      priority,
      period,
      category,
      timeOfDay,
      completed: false
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: `task-parsed-${idCounter}`,
      title: "Review and Organize Day",
      description: "Start by jotting down your goals for today.",
      duration: 15,
      priority: "high",
      period: "today",
      category: "other",
      timeOfDay: "Morning",
      completed: false
    });
  }

  return { tasks };
}

function getLocalWorkflow(taskId: string, title: string, description: string, duration: number, priority: string, period: string) {
  const domain = getTaskDomain(title, description);
  const totalMin = duration || 30;

  let steps: any[] = [];
  let roadblocks: any[] = [];
  let focusTips: string[] = [];
  let playlistMood = "Binaural Focus Beats";

  if (domain === "coding") {
    const s1 = Math.max(5, Math.round(totalMin * 0.15));
    const s2 = Math.max(5, Math.round(totalMin * 0.20));
    const s3 = Math.max(10, Math.round(totalMin * 0.40));
    const s4 = Math.max(5, Math.round(totalMin * 0.15));
    const s5 = totalMin - (s1 + s2 + s3 + s4);
    steps = [
      {
        id: "step-1",
        title: "Prepare Workspace & Block Notifications",
        description: "Set your IDE to full-screen, turn off messaging notifications, and keep a clean notepad close by for transient thoughts.",
        duration: s1,
        tips: ["Mute all personal devices.", "Set active timers."]
      },
      {
        id: "step-2",
        title: "Formulate Architecture & Input/Output Paths",
        description: "Map out code structures, sketch logical flows, and list potential edge cases. Design the happy path API schema first.",
        duration: s2,
        tips: ["Visual flowcharts build clean code.", "Don't write syntax yet."]
      },
      {
        id: "step-3",
        title: "Execute Code Implementation & Basic Tests",
        description: "Write clean, modular code. Compile or run local build checks frequently to catch errors instantly before they compound.",
        duration: s3,
        tips: ["Focus purely on core functionality.", "Avoid early micro-optimizations."]
      },
      {
        id: "step-4",
        title: "Refactor, Clean Imports & Add Types",
        description: "Strengthen types, clear out dead code blocks, refactor redundant loops, and make variable names expressive and self-documenting.",
        duration: s4,
        tips: ["Readability is key.", "Address typescript warnings now."]
      },
      {
        id: "step-5",
        title: "Manual Quality Assurance & Git Commit",
        description: "Manually test the changes, log happy/sad paths, write clean descriptive commit messages, and push your branch.",
        duration: Math.max(5, s5),
        tips: ["Verify responsive design.", "Commit with standard prefixes (feat/fix)."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Getting lost in massive refactoring loops or library updates midway.",
        solution: "Use raw code mocks or TODO markers for complex items, finish your primary flow first, then revisit."
      },
      {
        obstacle: "Losing focus due to continuous compilation errors.",
        solution: "Break the problem down. Backtrack to your last working state or comment out surrounding code blocks."
      }
    ];
    focusTips = [
      "Code with high intention: Write down what you are trying to solve in one line before starting.",
      "Apply the Rule of 3: Get it working, make it pretty, make it fast.",
      "A 40Hz binaural beat keeps logical verbal parts of your brain perfectly synchronized."
    ];
    playlistMood = "Binaural Cybernetic Synthwave";
  } else if (domain === "writing") {
    const s1 = Math.max(5, Math.round(totalMin * 0.15));
    const s2 = Math.max(5, Math.round(totalMin * 0.20));
    const s3 = Math.max(10, Math.round(totalMin * 0.45));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Brainstorming & Creative Free Writing",
        description: "Spend 5-10 minutes jotting down all angles, hook concepts, and raw points without censoring or editing any thoughts.",
        duration: s1,
        tips: ["Write quickly, do not correct typos.", "Quantity breeds quality first."]
      },
      {
        id: "step-2",
        title: "Structuring and Creating the Content Outline",
        description: "Arrange brainstormed points into a crisp narrative structure. Set up introduction hooks, core thematic blocks, and clear headers.",
        duration: s2,
        tips: ["A strong structure prevents writer's block.", "Determine the core takeaway."]
      },
      {
        id: "step-3",
        title: "Deep Drafting and Core Content Compilation",
        description: "Flesh out the outline sections. If you need a exact citation or figure, place [TBD] as a placeholder and keep writing.",
        duration: s3,
        tips: ["Don't look back while writing.", "Focus purely on flow and expression."]
      },
      {
        id: "step-4",
        title: "Line Editing, Proofing & Formatting Polish",
        description: "Read your drafted text aloud. Shorten wordy sentences, fix grammar, verify links, and polish the emotional resonance.",
        duration: Math.max(5, s4),
        tips: ["Vigorous editing creates strong prose.", "Read out loud to catch awkward spacing."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Anxiety about the quality of early drafts causing you to delete lines constantly.",
        solution: "Separate writing from editing completely. Tell yourself that the first draft is purely meant for your eyes only."
      },
      {
        obstacle: "Getting distracted by online research or finding the perfect synonym.",
        solution: "Place simple placeholder marks like [STUFF] or [FIND WORD] to keep typing, and batch research at the very end."
      }
    ];
    focusTips = [
      "Write hot, edit cold: draft with passion, edit with surgical precision later.",
      "Keep sentences punchy and vary paragraph lengths to build elegant reading momentum.",
      "Lofi tracks and soft rain eliminate verbal analyzer blocks, letting the creative mind speak."
    ];
    playlistMood = "Warm Cozy Lofi Writer's Room";
  } else if (domain === "study") {
    const s1 = Math.max(5, Math.round(totalMin * 0.15));
    const s2 = Math.max(10, Math.round(totalMin * 0.50));
    const s3 = Math.max(5, Math.round(totalMin * 0.20));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Survey Material & Set Learning Hypotheses",
        description: "Scan chapters, index headlines, and review chapter summaries. Write down three active questions you aim to fully answer.",
        duration: s1,
        tips: ["Pre-scanning primes the brain for learning.", "Identify key terminology."]
      },
      {
        id: "step-2",
        title: "Active Learning & Hand-Written Synthesis Notes",
        description: "Read, watch, or listen with deliberate focus. Write summaries in your own words. Do not highlight passively; summarize.",
        duration: s2,
        tips: ["Create micro mind-maps.", "Relate new info to things you already know."]
      },
      {
        id: "step-3",
        title: "Active Recall & Conceptual Reconstruction",
        description: "Close all textbooks, notes, and screens. On a blank sheet of paper, sketch out the major framework from pure memory.",
        duration: s3,
        tips: ["Memory retrieval is the key to deep retention.", "Spot precisely where your memory fails."]
      },
      {
        id: "step-4",
        title: "The Feynman Explanatory teaching method",
        description: "Explain the core concept aloud or on paper as if teaching it to an absolute beginner. Polish terms to remove jargon.",
        duration: Math.max(5, s4),
        tips: ["If you cannot explain it simply, you don't know it.", "Re-review sections where you struggled."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Falling into the 'Illusion of Competence' through highlighting pages passively.",
        solution: "Highlighting is passive. Force active recall by closing the material and testing yourself frequently."
      },
      {
        obstacle: "Fatigue and cognitive overwhelm from massive blocks of texts.",
        solution: "Employ Pomodoro. Study in focused 25-minute windows with 5 minutes of visual rest (no screens)."
      }
    ];
    focusTips = [
      "Active recall and spaced repetition are the gold standards of high-performance learning.",
      "Teaching is the highest form of mastery. Apply the Feynman technique to every complex concept.",
      "Theta frequencies facilitate memory consolidation, relaxed alertness, and cognitive absorption."
    ];
    playlistMood = "Ethereal Ambient Library";
  } else if (domain === "design") {
    const s1 = Math.max(5, Math.round(totalMin * 0.20));
    const s2 = Math.max(5, Math.round(totalMin * 0.30));
    const s3 = Math.max(10, Math.round(totalMin * 0.35));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Gather Inspiration & Map Guidelines",
        description: "Review top-tier design galleries, curate color boards, and analyze typographic options. Write down the strict aesthetic constraints.",
        duration: s1,
        tips: ["Keep inspiration structured, avoid endless scrolling.", "Look for direct structural analogies."]
      },
      {
        id: "step-2",
        title: "Low-Fi Prototyping & Layout Sketching",
        description: "Sketch wireframes on paper or in grayscale. Experiment with 3 distinct balance options within 10 minutes to bypass early bias.",
        duration: s2,
        tips: ["Constraints breed outstanding layout design.", "Always work in grayscale first."]
      },
      {
        id: "step-3",
        title: "Digital Styling, Grids, and Components",
        description: "Build clean layouts. Arrange grids, select typography scales, and add high-contrast components and elegant visual rhythm.",
        duration: s3,
        tips: ["Stick to one main display font.", "Use proportional vertical spacing."]
      },
      {
        id: "step-4",
        title: "Micro-refinement, Alignments & Asset Exports",
        description: "Double check margins, audit color contrast levels, ensure proper touch-targets, and clean export layers.",
        duration: Math.max(5, s4),
        tips: ["Use whitespace as a design element.", "Review layout at 25% scale for balance."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Getting stuck picking perfect color values too early.",
        solution: "Design in absolute black and white. If the design does not work in grayscale, colors will not save it."
      },
      {
        obstacle: "Endless scrolling through reference platforms for 'inspiration'.",
        solution: "Limit active research time strictly to 10 minutes, then force yourself to sketch 3 immediate wireframes."
      }
    ];
    focusTips = [
      "Simplicity is the ultimate sophistication. When in doubt, remove elements and expand whitespace.",
      "Always design with structured grid systems to maintain visual trust and alignment.",
      "Soft acoustic lofi music maintains a calming, highly creative flow."
    ];
    playlistMood = "Chilled Chillhop Coffee Lounge";
  } else if (domain === "admin") {
    const s1 = Math.max(5, Math.round(totalMin * 0.15));
    const s2 = Math.max(10, Math.round(totalMin * 0.50));
    const s3 = Math.max(5, Math.round(totalMin * 0.20));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Gather Materials, Triage & Sort",
        description: "Compile necessary files, spreadsheets, or links. Rank all correspondence or data points by absolute importance.",
        duration: s1,
        tips: ["Mute all active chat logs.", "Clear your desktop screen."]
      },
      {
        id: "step-2",
        title: "Execution & Concise Drafting Sprints",
        description: "Write clear, bulleted answers. Complete data Entry, fill out requests, and solve issues. Keep messages brief and action-oriented.",
        duration: s2,
        tips: ["Use bullet points to keep messages easily scannable.", "Keep drafts out of active inbox folders."]
      },
      {
        id: "step-3",
        title: "Audit, Quality Checks & Final Dispatch",
        description: "Carefully review calculated numbers, verify recipient addresses, check attachment files, and finalize drafts.",
        duration: s3,
        tips: ["Double check link permissions.", "Read important numbers twice."]
      },
      {
        id: "step-4",
        title: "System Updates & Follow-up Calendar logs",
        description: "Log dates, set reminders in calendar schedules, clean out temporary download files, and close related workspace tabs.",
        duration: Math.max(5, s4),
        tips: ["Keep calendar items up to date.", "Clear workspace to reduce clutter."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Getting sidetracked reading new incoming emails or messages.",
        solution: "Completely close mail tabs while working on drafts. Use dedicated scratchpad files for drafting."
      },
      {
        obstacle: "Procrastination due to repetitive or boring tasks.",
        solution: "Utilize the '10-minute sprint' rule. Tell yourself you can stop once the timer goes off. Usually, you will continue."
      }
    ];
    focusTips = [
      "The 2-Minute Rule: If an action takes under two minutes, execute it immediately without scheduling.",
      "Triage with absolute intent. Protect your attention from low-priority inbound signals.",
      "Clean Alpha waves keep verbal analytical centers highly focused and productive."
    ];
    playlistMood = "Minimal Focus Coffee Shop Noise";
  } else if (domain === "health") {
    const s1 = Math.max(5, Math.round(totalMin * 0.20));
    const s2 = Math.max(10, Math.round(totalMin * 0.55));
    const s3 = Math.max(5, Math.round(totalMin * 0.15));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Preparation, Warm-Up & Intention Setting",
        description: "Complete joint mobilizations, dynamic stretching, or slow breathing. Define your session's primary fitness/wellness goal.",
        duration: s1,
        tips: ["Focus on proper posture early.", "Hydrate well."]
      },
      {
        id: "step-2",
        title: "Main Routine Execution & Mindful Movement",
        description: "Perform your core workout drills, deep stretches, or meditation sets. Align each movement with measured, rhythmic breathing.",
        duration: s2,
        tips: ["Prioritize perfect mechanics over raw volume.", "Stay connected to bodily feedback."]
      },
      {
        id: "step-3",
        title: "Cool Down, Progressive Relaxation & Hydration",
        description: "Gently lower heart rates. Complete static stretching to release tension, and hydrate your body.",
        duration: s3,
        tips: ["Deep exhalations trigger relaxation.", "Allow heart rate to normalize."]
      },
      {
        id: "step-4",
        title: "Reflection & Session Log Tracking",
        description: "Jot down metrics (sets, weights, heart rate, or state of mind) in your journal. Celebrate this health victory.",
        duration: Math.max(5, s4),
        tips: ["Consistency is the ultimate driver.", "Acknowledge yourself for showing up."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Mental exhaustion causing procrastination before starting.",
        solution: "Commit to simply putting on your exercise gear and completing just the 5-minute warm-up."
      },
      {
        obstacle: "Compulsively checking your phone or social updates during breaks.",
        solution: "Place your phone across the room or set it to 'Do Not Disturb'. Focus on physical sensations."
      }
    ];
    focusTips = [
      "Physical form is a sacred prerequisite for sustainable progress.",
      "Synchronize your breathing patterns with active movements to tap into somatic flow states.",
      "Dynamic rhythmic audio blocks distractions and amplifies kinetic stamina."
    ];
    playlistMood = "Energetic Beats & Power Chords";
  } else if (domain === "housework") {
    const s1 = Math.max(5, Math.round(totalMin * 0.15));
    const s2 = Math.max(10, Math.round(totalMin * 0.55));
    const s3 = Math.max(5, Math.round(totalMin * 0.20));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Gather Tools & Map Out cleaning Zones",
        description: "Pick up visible out-of-place clutter. Gather all cleaners, cloths, and vacuums in one central container to avoid pacing.",
        duration: s1,
        tips: ["Clean workspaces boost clear thinking.", "Work on one room at a time."]
      },
      {
        id: "step-2",
        title: "Execute the Top-to-Bottom method",
        description: "Always clean surfaces starting from the top down. Dust high shelves, wipe down appliances, and vacuum or mop floors last.",
        duration: s2,
        tips: ["Let cleaners sit for 2 minutes to work.", "Maintain steady pacing."]
      },
      {
        id: "step-3",
        title: "Tidying, detailing, and Resetting Items",
        description: "Organize items back into their home positions. Wipe down mirrors, empty trash receptacles, and air out the room.",
        duration: s3,
        tips: ["Wipe handles and switches.", "Organize containers nicely."]
      },
      {
        id: "step-4",
        title: "Atmosphere polish & Visual Refresh",
        description: "Spray a calming ambient scent, light a candle, or open windows for fresh air. Sit back and enjoy the fresh space.",
        duration: Math.max(5, s4),
        tips: ["A tidy environment fosters a quiet mind.", "Log chores as completed."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Getting distracted by photos, books, or old letters you uncover.",
        solution: "Create a temporary 'Organize Later' box. Toss rediscovered items in there and continue cleaning without delay."
      },
      {
        obstacle: "Feeling overwhelmed by the total amount of mess in the home.",
        solution: "Set a tiny boundary. Focus strictly on cleaning a single 3x3 feet quadrant first."
      }
    ];
    focusTips = [
      "Treat cleaning as a physical mindfulness ritual. Engage fully with your immediate surroundings.",
      "Pair chore sessions with engaging podcasts or high-tempo playlists to keep physical stamina high.",
      "Warm organic melodies reduce cleaning friction and make the physical process highly enjoyable."
    ];
    playlistMood = "Sunshine Acoustic Folk Chill";
  } else if (domain === "rest") {
    const s1 = Math.max(5, Math.round(totalMin * 0.20));
    const s2 = Math.max(10, Math.round(totalMin * 0.45));
    const s3 = Math.max(5, Math.round(totalMin * 0.25));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Initiate Screen Fast & Dim Lights",
        description: "Shut down computers, place phones on silent outside your physical reach, and transition into lower-lux lighting.",
        duration: s1,
        tips: ["Dim lights boost melatonin.", "Remove blue-light sources entirely."]
      },
      {
        id: "step-2",
        title: "Somatic Relaxation & Conscious Breathing",
        description: "Perform gentle, slow stretching, progressive muscle relaxation, or try square breathing (inhale 4, hold 4, exhale 4, hold 4).",
        duration: s2,
        tips: ["Deep exhalations slow down heart rate.", "Let your shoulders drop and jaw relax."]
      },
      {
        id: "step-3",
        title: "Sensory Comfort & Mindful Wind Down",
        description: "Enjoy warm decaf herbal tea, write down outstanding thoughts to empty your mind, or read a slow-moving physical book.",
        duration: s3,
        tips: ["Empty your brain on paper.", "Listen to ambient forest rain."]
      },
      {
        id: "step-4",
        title: "Surrender to Restful Stillness",
        description: "Lie down comfortably, close your eyes, let go of any deliberate focus, and allow your body to glide into rest.",
        duration: Math.max(5, s4),
        tips: ["Rest is a powerful productivity multiplier.", "Sleep sets up tomorrow's victories."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Compulsive thoughts of upcoming meetings or incomplete work preventing relaxation.",
        solution: "Draft a brain dump on paper. Assure yourself that everything is written down safely and you are allowed to rest."
      },
      {
        obstacle: "Checking your phone 'one last time' in bed and getting over-stimulated.",
        solution: "Set an absolute phone curfew. Charge your device across the room or in another area."
      }
    ];
    focusTips = [
      "Rest is not a luxury; it is the vital biological substrate of elite productivity.",
      "Slow, measured abdominal breathing shifts your central nervous system out of fight-or-flight in 90 seconds.",
      "Delta wave solfeggio ambient sleep soundscapes guide brain activity gently into deep, healing restorative states."
    ];
    playlistMood = "Delta Wave Solfeggio Ambient Sleep";
  } else {
    const s1 = Math.max(5, Math.round(totalMin * 0.20));
    const s2 = Math.max(5, Math.round(totalMin * 0.15));
    const s3 = Math.max(10, Math.round(totalMin * 0.50));
    const s4 = totalMin - (s1 + s2 + s3);
    steps = [
      {
        id: "step-1",
        title: "Set Concrete Goals & Milestones",
        description: "Define exactly what victory looks like for this specific block. Write down the single most crucial outcome.",
        duration: s1,
        tips: ["A goal without timelines is just a wish.", "Avoid multi-tasking."]
      },
      {
        id: "step-2",
        title: "Set Up Your Desk & Block Distractions",
        description: "Prepare all materials, check internet links, mute chats, and keep hydration nearby. Create an frictionless environment.",
        duration: s2,
        tips: ["Keep your immediate workspace minimal.", "Close unrelated browser windows."]
      },
      {
        id: "step-3",
        title: "Deep Execution & High-Intensity Focus",
        description: "Immerse yourself deeply in the task at hand. Keep working with deliberate speed and high attention.",
        duration: s3,
        tips: ["Do not stop to check messages.", "Keep a scratchpad for random ideas."]
      },
      {
        id: "step-4",
        title: "Review Achievements & Clean Up",
        description: "Evaluate your outcomes, tidy up files or physical materials, and define the absolute next starting step.",
        duration: Math.max(5, s4),
        tips: ["A clean wrap-up preserves momentum.", "Track your progress in logs."]
      }
    ];
    roadblocks = [
      {
        obstacle: "Struggling with early resistance or feeling bored.",
        solution: "Utilize the 5-minute rule. Force yourself to work with focus for exactly five minutes, and momentum will take over."
      },
      {
        obstacle: "Mental exhaustion mid-way causing slow pacing.",
        solution: "Stand up, complete a quick physical stretch, drink some cold water, and resume with a refreshed mind."
      }
    ];
    focusTips = [
      "Starting is 90% of the friction. Apply the 5-Minute Rule to shatter procrastination instantly.",
      "Process over outcome: derive deep pleasure from the physical act of focused work.",
      "Sustained alpha waves and rain block noise and maintain deep attention."
    ];
    playlistMood = "Deep Focus Ambient Rain";
  }

  return { taskId, steps, roadblocks, focusTips, playlistMood, isFallback: true };
}

function getLocalPrioritization(tasks: any[]) {
  const prioritizedTasks = tasks.map(task => {
    let priority: 'high' | 'medium' | 'low' = 'medium';
    const textLower = `${task.title} ${task.description || ""}`.toLowerCase();
    
    if (/\b(urgent|asap|critical|must|important|deadline|exam|meeting|call|client|invoice|tax|rent|bills|doctor|health)\b/i.test(textLower)) {
      priority = 'high';
    } else if (/\b(chore|routine|casual|someday|optional|low|maybe|browse|social|relax|nap|break)\b/i.test(textLower)) {
      priority = 'low';
    }
    return { id: task.id, priority };
  });
  return { prioritizedTasks };
}

function getLocalScheduling(tasks: any[], habits: any[], options: any) {
  const timeFrozenTasks = tasks.filter(t => t.timeFrozen && t.scheduledTime);
  const nonFrozenTasks = tasks.filter(t => !(t.timeFrozen && t.scheduledTime));

  const sortedNonFrozen = [...nonFrozenTasks].sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
  });

  const scheduledTasks: any[] = [];
  const newBreaks: any[] = [];

  // Pre-schedule frozen tasks
  timeFrozenTasks.forEach(ft => {
    scheduledTasks.push({
      id: ft.id,
      scheduledTime: ft.scheduledTime,
      priority: ft.priority,
      period: ft.period
    });
  });

  const activeHabits = (habits || []).filter(h => h.enabled).map(h => {
    const [hh, mm] = h.time.split(":").map(Number);
    const start = hh * 60 + mm;
    return { start, end: start + h.duration };
  });

  const blockedBlocks = [
    ...activeHabits,
    ...timeFrozenTasks.map(ft => {
      const [hh, mm] = ft.scheduledTime.split(":").map(Number);
      const start = hh * 60 + mm;
      return { start, end: start + ft.duration };
    })
  ];

  let currentMinutes = 480; // 8:00 AM

  for (let i = 0; i < sortedNonFrozen.length; i++) {
    const task = sortedNonFrozen[i];
    
    // Shift currentMinutes past any blocked blocks (habits or frozen tasks)
    let shifted = true;
    while (shifted) {
      shifted = false;
      for (const block of blockedBlocks) {
        const taskStart = currentMinutes;
        const taskEnd = currentMinutes + task.duration;
        if ((taskStart >= block.start && taskStart < block.end) || 
            (taskEnd > block.start && taskEnd <= block.end) ||
            (block.start >= taskStart && block.end <= taskEnd)) {
          currentMinutes = block.end;
          shifted = true;
          break;
        }
      }
    }

    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const hhmm = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    
    scheduledTasks.push({
      id: task.id,
      scheduledTime: hhmm,
      priority: task.priority,
      period: task.period
    });
    
    currentMinutes += task.duration;
    
    if (options?.includeBreaks && i < sortedNonFrozen.length - 1) {
      currentMinutes += 30;
    }
  }

  return { scheduledTasks, newBreaks };
}

function getLocalSummary(tasks: any[]) {
  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);

  let overview = "Yesterday, you made valuable strides in organizing your tasks. Even simple steps help construct structured workflows and bring you closer to deep momentum.";
  if (completed.length > 0) {
    const highlights = completed.slice(0, 2).map(t => `"${t.title}"`).join(" and ");
    overview = `Outstanding work yesterday! You successfully focused on and checked off crucial milestones, including ${highlights}. Tackling these items builds clean momentum and reinforces your focus habits.`;
  }

  const recommendations = [
    "Identify your top critical action today and block out the first 45 minutes of the morning for it.",
    "Utilize the Focus Workflow Center to break down complex tasks into smaller, less intimidating steps.",
    "Pair your next focus block with theta or alpha waves to block out distracting environments."
  ];

  if (pending.length > 0) {
    recommendations[1] = `Take a close look at incomplete actions like "${pending[0].title}". Consider breaking them down into 10-minute micro-steps.`;
  }

  const mantras = [
    "Focus is a muscle. Every time you redirect your attention back to your task, you strengthen it.",
    "You do not need to feel like doing something to do it. Action precedes motivation.",
    "The secret of getting ahead is getting started. Break it down and move forward."
  ];
  const mantra = mantras[Math.floor(Math.random() * mantras.length)];

  return {
    overview,
    recommendations,
    mantra,
    isFallback: true
  };
}

function getTaskDomain(title: string, description: string): string {
  const text = `${title} ${description || ""}`.toLowerCase();
  if (/\b(code|coding|program|compile|debug|git|react|api|software|build|fix|test|database|deploy|typescript|javascript|python|html|css|developer|dev|bug|sdk|endpoint)\b/i.test(text)) {
    return "coding";
  }
  if (/\b(write|writing|blog|email|copy|draft|essay|article|document|edit|resume|novel|story|newsletter|post)\b/i.test(text)) {
    return "writing";
  }
  if (/\b(study|reading|read|learn|course|lecture|book|research|prep|exam|homework|quiz|class|academic|notes)\b/i.test(text)) {
    return "study";
  }
  if (/\b(plan|design|draw|sketch|wireframe|logo|brainstorm|ui|ux|creative|illustration|art|paint|prototype|figma|photoshop)\b/i.test(text)) {
    return "design";
  }
  if (/\b(email|emails|call|zoom|chat|message|meeting|schedule|invoice|tax|bills|finance|admin|office|file|reports|report)\b/i.test(text)) {
    return "admin";
  }
  if (/\b(workout|gym|run|running|stretch|meditation|yoga|walk|exercise|cardio|fitness|lift|training|bike|cycle|healthy|health)\b/i.test(text)) {
    return "health";
  }
  if (/\b(clean|cleaning|wash|laundry|tidy|cook|cooking|grocery|shop|shopping|dish|dishes|organize|apartment|room|house|kitchen|vacuum|dust)\b/i.test(text)) {
    return "housework";
  }
  if (/\b(rest|sleep|break|relax|wind down|nap|chill|relaxing|meditate|unwind)\b/i.test(text)) {
    return "rest";
  }
  return "generic";
}

// Handle serving SPA assets and routing
async function startServer() {
  // Initialize database connection (MongoDB or local JSON fallback)
  await initDB();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
