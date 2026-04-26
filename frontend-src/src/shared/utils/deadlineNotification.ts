// src/shared/utils/deadlineNotification.ts
// Browser push notification utility for deadline reminders.
// Gracefully handles denied/unsupported permission with a silent fallback.

/**
 * Requests Notification permission (once) and fires a browser notification
 * when a deadline reminder is due.
 *
 * @param documentTitle  The human-readable document title shown in the notification.
 * @param daysLeft       How many days until the deadline (1 or 3 for reminders).
 * @returns              `true` if the notification was successfully fired.
 */
export async function requestDeadlineNotification(
  documentTitle: string,
  daysLeft: number
): Promise<boolean> {
  // Guard: Notification API not available (e.g., Firefox private mode, some iOS)
  if (!('Notification' in window)) return false;

  // Request permission if not yet decided
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Some browsers throw if called outside a user gesture — silently ignore
      return false;
    }
  }

  // Bail silently if the user denied
  if (Notification.permission !== 'granted') return false;

  const title = daysLeft === 1 ? '📚 Deadline Tomorrow!' : `📚 Deadline in ${daysLeft} Days`;
  const body =
    daysLeft === 1
      ? `Your deadline for "${documentTitle}" is tomorrow. Keep going!`
      : `You have ${daysLeft} days left to finish "${documentTitle}". Stay on track!`;

  try {
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `docvia-deadline-${documentTitle}-${daysLeft}`, // deduplicates repeat pings
    });
    return true;
  } catch {
    return false;
  }
}