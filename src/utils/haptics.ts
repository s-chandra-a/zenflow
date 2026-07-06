export const safeVibrate = (ms: number) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (error) {
    // Fail silently without polluting console logs
  }
};
