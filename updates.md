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

---

## 📅 12. Smart Completed Tasks Scheduling
- **Completed Tasks Before Current Time**: Any task marked completed that is already scheduled before the current scheduling time boundary is automatically ignored and locked exactly at its current scheduled slot, preserving historical timeline data.
- **Completed Tasks After Current Time (Jammed)**: Any task marked completed that was scheduled *after* the current scheduling boundary (or has no time assigned) is automatically moved up and stacked back-to-back, ending exactly at the current time boundary.
- **Timeline Optimization**: Jamming completed tasks in the past ensures they do not occupy valuable future slots, leaving maximum scheduling space open for remaining incomplete tasks.
- **Deterministic Preprocessing**: Implemented this logic in the backend scheduler router of `server.ts` to preprocess tasks before calling either the AI engine or the local fallback scheduler, ensuring absolute reliability and consistency.

---

## 🚀 13. System Integrity & User Warning Upgrades
- **Rollover Catch-Up Engine**: Upgraded daily rollover calculation inside `src/App.tsx` to measure date difference between `lastRolloverDate` and the current date, adjusting the tracked `daysCount` dynamically by the correct number of missed days when returning from a long absence.
- **Manual Overlap & Collision Warnings**: Added an overlap checker loop inside `CalendarAgenda.tsx` that identifies any time collision across active tasks on the timeline and displays a warning badge (`⚠️ Overlap`) next to task details on affected cards. Completed tasks are ignored during conflict checks so warnings only highlight incomplete items.
- **Gemini vs. Fallback Status Indicator**: Added a server-side status endpoint (`/api/ai-status`) to monitor key state.
- **Habits Overlap Detection**: Overlap warnings now automatically detect when tasks collide with active habit slots if the `Mind habits` option is active, giving users a holistic view of scheduling block overlaps.
- **Long Duration Directional Span Indicators**: Replaced empty hour slots (like `"No events scheduled"`) with a subtle `"In Progress"` span indicator showing the task title and an arrow (`↓`) matching the task's duration span to visualize ongoing time blocks and busy slots.
- **Separate Fallback Console Alerts**: Built a dedicated top-level warning panel in `src/App.tsx` that triggers anytime local/offline fallbacks are used instead of Gemini or MongoDB. Warnings display as persistent red alerts containing a title, a warning description, a close button, and a precise timestamp.
- **Calendar Task View Navigation**: Added a View icon (`Eye`) to the left of the task title text on calendar task cards. Clicking this switches the layout view to list-mode (switching mobile tabs if necessary), scrolls the targeted task card into view, and highlights the card with a theme-aware ring glow for 2 seconds.
- **Excluded Completed Tasks from Progress/Overlap**: Configured ongoing task indicators (`In Progress` span blocks) to ignore completed tasks, keeping the timeline free of completed historical span fillers.
- **Visual Schedule Upgrades**: Removed borders completely from the `"In Progress"` indicators, changed their arrow direction to pointing up (`↑`), and disabled animation for a more subtle look.
- **Documentation Updates**: Documented the full application tech stack in `README.md` including React, Vite, Custom HSL Themes, Express, MongoDB, local fallback database, and Gemini 2.5 integration.

---

## 📱 14. Mobile Usability, Scorecard Danger Zone, & Text Adjustments
- **Removed Swipe-to-Complete Gesture**: Removed all touch-swipe gesture controls, states, and translation style transformations from the task cards to prevent accidental checks during normal list scrolling.
- **Enlarged Mobile Checkboxes (Radio Checks)**: Configured all circular checklist targets (task cards, habits, calendar agenda) to expand to `w-7 h-7` (28px tap target) on mobile screens (`< 1024px`), while retaining their default sizes on desktop layouts to improve touch accuracy.
- **Cleaned Up Swipe Tutorial Toast**: Removed the `"swipe-hint"` toast notifications and the local storage tutorial state tracks.
- **Audio Visualizer Removal**: Removed the animated sound wave visualizer bar panel under binaural sound generator states in the Focus panel.
- **Floating Add Pill Button Visibility**: Conditioned the mobile floating `Add + AI` pill button to hide completely when in the Add (`input`) tab, avoiding redundant overlays.
- **Calendar Occupied Slot Indicator**: Renamed the timeline's continuing indicator text from `"In Progress"` to `"Occupied"` and swapped the clock icon for a `Briefcase` icon.
- **Notification Adjustments**: Silenced toast notifications upon checking off a task and switching binaural focus wave types to provide a calmer user experience.
- **Quick Add Task Duration Typing Bug Fix**: Redefined states as `number | ""` and updated `onChange` callbacks to allow empty inputs temporarily. Users can now backspace and type durations freely without inputs instantly snapping back to their default values (which are automatically applied on save if left empty).
- **Isolated Yesterday Tray Deletion Card**: Relocated the "Delete Yesterday's tasks" feature from the Productivity Stats card into its own dedicated warning box, titled **"Delete Yesterday's task tray"** and styled with alert-exclamation warning signs (`AlertTriangle` icons) and a rose-red border.
- **Collapse Timeline Controls**: Added expand/collapse toggle controls to the Agenda Timeline (expanded by default, saved in local storage). On desktop layouts, a text button is docked in the header; on mobile views, a floating glassmorphic round icon button is horizontally centered right above the bottom navigation bar (`fixed bottom-24 left-1/2 -translate-x-1/2 z-40`). The button displays clean down/up arrows (`ChevronDown` / `ChevronUp` icons) based on the collapsed state without text labels. When collapsed, empty timeline hours are hidden, and multi-hour tasks are filtered to render only at their **first** position (start slot) and **last** position (end slot), hiding all intermediate/middle occupied rows to minimize scrolling.
- **Occupied Row Layout Improvements**: Modified ongoing occupied calendar cards using flexbox parameters (`flex-1 min-w-0 mr-3` for titles and `shrink-0` for labels) so task titles automatically contract and truncate with ellipsis, avoiding wrapping or overlap with the `"Busy ↑"` text on narrow displays.
- **Chronological Timezone Rollover Protection**: Refactored the daily rollover check from a simple inequality (`!==`) to a chronological check (`currentHabitDay > serverSettings.lastRolloverDate`). This protects users who open the app on multiple devices with different timezone configurations or clock offsets from triggering accidental duplicate rollovers.
- **Customizable Wake-Up/Rollover Boundary**: Integrated a `rolloverHour` property into the database Settings schema, settings sync handlers, and React states. Added a dropdown select under Stats below Yesterday Archiving to configure this hour (0-23, formatted as AM/PM options), dynamically aligning Zen Flow's rollover time with the user's wakeup schedule.
- **Manual Forced Rollover Trigger**: Added a force rollover execution button docked in the settings card. The button displays a warning panel containing confirmation options ("Yes, Execute" or "Cancel") explaining that the operation will shift tomorrow's tasks onto today, archive today's tasks to yesterday, and update productivity statistics immediately.
- **Preferences Tab & Icon Remap**: Renamed the right panel "Scorecard" tab to "Preferences" (and the corresponding mobile navigation tab to "Prefs"). Swapped the old `TrendingUp` icon for a `Settings` icon to better reflect the customization capabilities (such as Database syncing, Rollover configurations, and Archiving toggles) grouped in this control area.
- **Preferences Component Reordering**: Arranged controls inside the Preferences tab to flow logically: 1. Productivity Stats ( radial ring and counts scorecard), 2. Yesterday Archiving toggle, 3. Daily Rollover Settings (custom wake-up boundary selector and force rollover button), and 4. Delete Yesterday's task tray card.
- **Glassmorphic Mobile UI Refinement**: Upgraded the top bar (sticky header), mobile floating bottom navbar, and all mobile floating pill buttons (including the Add/AI task generator, AI Studio Quota monitor toggle, and centered timeline expand/collapse toggle buttons) with increased translucency (`bg-white/70` / `dark:bg-nature-900/70` for components and `bg-white/60` / `dark:bg-nature-900/60` for the navigation bar) and enhanced frosted glass blur levels (`backdrop-blur-lg` / `backdrop-blur-xl`) to look exceptionally premium and modern on mobile layouts.
- **Habit Streak Restoration Safeguard**: Fixed a critical bug in the habits streak calculator where checking, unchecking, and re-checking a habit multiple times on the same day would reset the long-term streak to 1. Integrated a self-healing lastCompletedDate rollback mechanism: unchecking today's completed habit now rolls the `lastCompletedDate` back to `habitYesterdayStr` (if the streak was > 1) and decrements the streak count by 1 instead of setting the date to blank. When checked again on the same day, the engine correctly identifies the yesterday continuation, incrementing the streak back to its original value rather than resetting it to 1.
- **Collapsed-by-Default Agenda Timeline**: Swapped the timeline's initialization state check from checking for equality (`=== "true"`) to checking for inequality (`!== "false"`). First-time users or those opening the app with a cleared local storage cache will now default to the clean, compact collapsed view (hiding empty hours), keeping the layout tidy.


















