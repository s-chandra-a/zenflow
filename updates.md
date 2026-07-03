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
