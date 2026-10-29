/** YouTube player events, logged to the browser console (F12) to help diagnose playback problems. */
export function debugLog(event: string, data: Record<string, unknown> = {}) {
  console.debug(`[youtube] ${event}`, data)
}
