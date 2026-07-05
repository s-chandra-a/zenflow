# Zenflow Implemented Features & Updates

Welcome to the comprehensive update log of **Zenflow**. This document details all features, architectural improvements, and visual updates implemented to date.

---

## 🔑 1. Core Integration & Settings
- **API Key & Database Wiring**: Wired the system to utilize your active Gemini API key and connected Zenflow to your online MongoDB Atlas database (with a local `db.json` fallback).
- **Dynamic Model Fetching**: Added a dynamic `GET /api/models` endpoint that retrieves text-compatible Gemini models from the API.
- **Model Selection dropdown**: Rendered the available choices in the **AI Quota** popover settings, routing all backend prompts to the active selection (defaulting to `gemini-2.5-flash`).

---

## 📅 2. Task Timeline & AI Scheduler
- **Timeline Extension**: Expanded the calendar daily timeline bounds from 8:00 AM – 8:00 PM to **8:00 AM – 11:00 PM** with standard **30-minute interval slots**.
- **Current-Time Aware AI Scheduling**: The scheduler schedules tasks starting dynamically from the current client time onwards instead of starting at a fixed 8:00 AM.
- **Blank Gaps Constraint**: When "Include Breaks" is checked, the AI scheduler leaves a blank 30-minute gap between every consecutive pair of tasks, avoiding back-to-back overlaps.
- **Bypass Break Tasks**: Instructed the AI to skip generating dummy break tasks (like "Break & stretch" or filler tasks) and instead adjust the schedule to leave those slots empty.
- **Tomorrow Scheduler Override**: If the AI scheduler is run while viewing tomorrow's focus tab, it overrides all current-time overflow constraints, scheduling all tasks directly starting from 8:00 AM.
- **Scheduler Disclaimer**: Added a clear warning banner inside the settings popover advising that running the scheduler can overwrite task priorities and custom timings.

---

## 📥 3. Schedule Overflow Tray Card
- **Overflow Pool**: Removed the automatic shift-to-tomorrow behavior. Today's tasks that cannot fit in the remaining timeline (before 11:00 PM) are returned with `period: 'overflow'`.
- **Dedicated Overflow Card**: Created a warning tray card displaying all unscheduled overflow tasks.
- **Interactive Actions**:
  - **Jam Today**: Forces the task onto today's schedule at 22:00.
  - **Move Tomorrow**: Migrates the task to tomorrow's focus list as unscheduled.
- **Database Schema support**: Extended the Mongoose task schema enum and TypeScript definitions to support the `"overflow"` period.

---

## ⚡ 4. Focus Workflow Panel
- **Visibility & Width**: Expanded the Focus panel to be wider, more visible, and set it to lock into a sticky position so you can access active task blueprints even when scrolling.
- **Complete & Finish Button Visibility**: Stretched the Focus Workflow panel lower to ensure that the primary action buttons are fully visible.
- **Focus Transition Fix**: Corrected the "Focus" triggers inside the Calendar tab, resolving the bug where it wouldn't switch focus views.

---

## 🔁 5. Daily Rollover Engine
- **8:00 AM Rollover**: Tasks automatically roll over at the 8:00 AM boundary:
  - Today's tasks shift to yesterday's column.
  - Tomorrow's tasks automatically shift to today's column.
- **Yesterday Archiving Preference Toggle**:
  - **Enabled**: Tasks remain accumulated in the yesterday archive column.
  - **Disabled**: Tasks are permanently deleted from both MongoDB and local file storage on rollover.

---

## 📈 6. Productivity Scorecard Tracker
- **Scorecard Tab Dashboard**: Added a third panel tab in the right sidebar.
- **Overall Performance Stats**: Tracks lifetime stats including total active days, completed tasks count, uncompleted tasks count, and overall productivity percentage.
- **Radial Score Meter**: Features an SVG circular progress meter that highlights performance tiers (Emerald for excellent, Amber for good, Rose for low).
- **Reset Trigger**: Added a reset button that zeros out active days and scorecard totals on the client and database levels.

---

## 🎯 7. Habits Tracker & Streak Milestones
- **Habit Checklist**: Added interactive checklist toggles next to active habits. Completion checkboxes dynamically clear out at the 8:00 AM rollover.
- **Streak Preservation (Pausing)**: Rebranded habit actions to **Pause/Resume**. If a habit is paused (`enabled: false`), its streak is frozen and preserved during inactivity instead of resetting to zero.
- **Streak click animation**: Turned streak tags into interactive buttons that spin, bounce, and scale up when clicked, showing active streak notification alerts.
- **Header Plus Icon**: Positioned a `<Plus />` icon next to the "Add Habit" text button in the panel header.

---

## 🎉 8. Confetti Celebration Effect
- **Confetti Cascades**: Designed a non-blocking background celebration overlay with 60 drifting colored confetti particles.
- **Triggers**:
  - Triggers automatically when a habit streak hits a multiple of **100 days**.
  - Triggers automatically when all scheduled tasks in a period are checked off (**100% Perfect Momentum Day**).
- **Non-blocking Interaction**: Confetti floats in the background for **5 seconds** and then automatically fades out. All page elements remain interactive during the celebration.

---

## 🔁 9. Habit Calendar Minding
- **Removed Auto-task Generation**: Active habits are no longer automatically added to today's task list, keeping the list clean and habits centralized in the Habit Manager.
- **Mind Habits in Schedule Option**: Added a toggle check in the AI Scheduler settings.
- **Translucent/Blurred Habit Cards**: When checked, the scheduler leaves slots blank for active habits based on their start time and duration, rendering translucent, blurred cards in those spaces.
- **Interactive Redirect Highlight**: Clicking any habit slot in the calendar timeline opens up the Habits Manager tab in the right sidebar, automatically scrolls to the matching card, and highlights it with a temporary green glowing border/shadow to indicate its location.

---

## 🎨 10. Calendar Visual Adjustments & Parser Time Field
- **Pulsating Animation Removed**: Removed the `animate-pulse` class from active habits rendered inside calendar timeline slots to keep the interface calm.
- **Subtle Habit Glowing Highlight**: Softened the glows and shadows on highlighted habit cards inside the Habit Manager panel (removed scale-105 zoom, reduced ring sizes and blur shadows) to make highlights subtle. The highlight ring dynamically maps to the active theme color (Sage for Forest Moss, Blue/Slate for Nordic Frost, Crimson/Red for Crimson Sand, Orchid/Purple for Royal Orchid) using theme variables.
- **Specific Time UI Input Field**: Added a new optional **Specific Time** (`time`) field to the Custom Task creator/editor form in the main view, next to the Time Bucket field.
- **AI Task Parser exact scheduling**: Enhanced the backend prompt in `/api/parse-tasks` to recognize exact task times in the text input and populate the `scheduledTime` field directly in the response. This guarantees that tasks with mentioned times (e.g. "at 14:00") place correctly in the calendar timeline upon parsing.
- **Removed Selection Toast**: Removed the notification toast alert that triggered when a habit card was clicked in the calendar timeline, providing a smoother redirection.

---

## 🔒 11. Time-Frozen Tasks
- **Time-Frozen Flag**: Added a `timeFrozen` boolean state/schema parameter to structured tasks (client-side interface and MongoDB database layers).
- **AI Task Parser Auto-freeze**: The Gemini parser automatically sets `timeFrozen: true` for any task where a specific start time is explicitly mentioned in the parsed user description (e.g. *"Standup meeting at 9:30 AM"*).
- **AI Scheduler Schedule-around Constraint**: Programmed the `/api/ai-scheduler` Gemini prompt to treat frozen tasks as strict constraints. The scheduler locks their scheduled times and schedules all non-frozen tasks *around* them to avoid overlap.
- **Local Fallback Scheduler Schedule-around**: Refactored the local scheduling algorithm in `server.ts` to pre-populate frozen tasks at their set times, block those intervals, and shift non-frozen tasks to the remaining free space.
- **Interactive Calendar Freeze Toggle**: Added a Lock/Unlock button next to the "Re-time" action in the calendar timeline card. Clicking it locks the task at its current slot, showing an amber **Frozen** badge next to its duration.
- **Manual Form Freeze Checkbox**: Added a **Freeze Time** checkbox to the Custom Task form (auto-selects when a Specific Time is inputted), giving users manual control over scheduling constraints.





