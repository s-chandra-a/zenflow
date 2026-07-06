import React, { useState, useEffect } from "react";
import { Bell, BellOff, X, Check, AlertTriangle, Info, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { InAppNotification } from "../types";

interface NotificationCenterProps {
  notifications: InAppNotification[];
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
  onToggleMute: () => void;
  isMuted: boolean;
}

export default function NotificationCenter({
  notifications,
  onClearAll,
  onMarkAsRead,
  onToggleMute,
  isMuted,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestBrowserPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const resp = await Notification.requestPermission();
      setPermission(resp);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative z-40" id="notification-center-container">
      {/* Bell Trigger */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-nature-100 dark:bg-nature-800 hover:bg-nature-200 dark:hover:bg-nature-750 border border-nature-300 dark:border-nature-700 transition-all duration-200 group text-nature-700 dark:text-nature-300 hover:text-nature-900 dark:hover:text-white cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage-600 text-[10px] font-bold text-white ring-2 ring-nature-100 dark:ring-nature-800 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              id="notification-dropdown"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed top-16 left-4 right-4 md:absolute md:top-auto md:right-0 md:left-auto md:w-96 mt-3 rounded-2xl border border-nature-200 dark:border-nature-800 bg-white/95 dark:bg-nature-900/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden w-auto"
            >
              {/* Header */}
              <div className="p-4 border-b border-nature-200 dark:border-nature-800 flex items-center justify-between bg-nature-50 dark:bg-nature-950">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sage-50 dark:bg-sage-950/40 text-sage-600 dark:text-sage-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-nature-850 dark:text-nature-50">
                    Productivity Alerts
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleMute}
                    className="p-1.5 rounded-lg text-nature-450 dark:text-nature-400 hover:text-nature-700 dark:hover:text-nature-200 hover:bg-nature-100 dark:hover:bg-nature-800 transition-colors cursor-pointer"
                    title={isMuted ? "Unmute sounds" : "Mute sounds"}
                  >
                    {isMuted ? (
                      <BellOff className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Bell className="w-4 h-4 text-sage-600" />
                    )}
                  </button>
                  {notifications.length > 0 && (
                    <button
                      onClick={onClearAll}
                      className="text-xs text-nature-500 dark:text-nature-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors font-medium cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Browser Permission Prompt if not enabled */}
              {permission !== "granted" && (
                <div className="p-3 bg-sage-50 dark:bg-sage-950/30 border-b border-sage-100 dark:border-sage-900/60 flex items-center justify-between gap-2">
                  <p className="text-xs text-sage-700 dark:text-sage-300 leading-relaxed">
                    Enable browser desktop notifications for real-time task alerts?
                  </p>
                  <button
                    onClick={requestBrowserPermission}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-semibold bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white rounded-lg transition-colors shadow-md shadow-sage-600/10 cursor-pointer"
                  >
                    Enable
                  </button>
                </div>
              )}

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-nature-200 dark:divide-nature-800">
                {notifications.length === 0 ? (
                  <div className="py-12 px-4 text-center text-nature-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20 text-nature-300" />
                    <p className="text-sm font-medium text-nature-700 dark:text-nature-300">All caught up!</p>
                    <p className="text-xs mt-1 text-nature-400 dark:text-nature-500">
                      Upload your schedule file to get tasks parsed and start focusing.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 transition-colors flex gap-3 ${
                        notif.read ? "bg-white dark:bg-nature-900" : "bg-nature-50/50 dark:bg-nature-950/20"
                      }`}
                    >
                      {/* Icon mapper */}
                      <div className="shrink-0 mt-0.5">
                        {notif.type === "success" && (
                          <div className="p-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {notif.type === "alert" && (
                          <div className="p-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                        )}
                        {notif.type === "warning" && (
                          <div className="p-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {notif.type === "info" && (
                          <div className="p-1 rounded-full bg-sage-50 dark:bg-sage-950/40 text-sage-600 dark:text-sage-400 border border-sage-100 dark:border-sage-900/40">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-xs font-semibold truncate ${
                              notif.read ? "text-nature-500 dark:text-nature-400" : "text-nature-800 dark:text-nature-150"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-nature-400 dark:text-nature-500 shrink-0 font-mono">
                            {new Date(notif.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-nature-600 dark:text-nature-300 mt-1 leading-normal break-words">
                          {notif.message}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="shrink-0 self-start flex flex-col gap-1.5">
                        {!notif.read && (
                          <button
                            onClick={() => onMarkAsRead(notif.id)}
                            className="p-1 rounded bg-white dark:bg-nature-900 hover:bg-nature-100 dark:hover:bg-nature-800 border border-nature-200 dark:border-nature-800 text-nature-450 dark:text-nature-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Mark read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
