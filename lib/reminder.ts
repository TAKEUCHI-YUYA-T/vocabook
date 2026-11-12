/**
 * 毎朝の学習のリマインダー（端末の中で予約する通知。サーバーは使わない）
 * 毎日 8:00 に、決まった文面を出す
 */
type NotificationsModule = Pick<
  typeof import("expo-notifications"),
  | "getPermissionsAsync"
  | "requestPermissionsAsync"
  | "setNotificationChannelAsync"
  | "cancelScheduledNotificationAsync"
  | "scheduleNotificationAsync"
  | "AndroidImportance"
  | "SchedulableTriggerInputTypes"
>;

export const REMINDER_ID = "daily-study-reminder";
export const REMINDER_CHANNEL_ID = "daily-study-reminder";
export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 0;
export const REMINDER_TITLE = "vocabook";
export const REMINDER_BODY = "継続は力なり！今日も学習を積み重ねよう！";

export type ReminderResult = "scheduled" | "denied" | "unavailable" | "failed";

/** 通知の部品を取り出す。含まれていない版のアプリでは null（テストでは、引数で差し替えられる） */
function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

/**
 * 通知の許可を確かめ（まだなら、聞き）、許可されていれば、毎日 8:00 の通知を予約し直す
 * 何度呼んでも、予約は1件だけ（同じ識別子で、先に取り消してから予約する）
 * 失敗しても、例外にしない（通知が出せなくても、アプリは使えるため）
 */
export async function scheduleDailyReminder(notifications: NotificationsModule | null = loadNotifications()): Promise<ReminderResult> {
  if (!notifications) return "unavailable";
  try {
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    if (!permission.granted) return "denied";

    await notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "毎日の学習のリマインダー",
      importance: notifications.AndroidImportance.DEFAULT,
    });
    await notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    await notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: REMINDER_TITLE, body: REMINDER_BODY },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: REMINDER_MINUTE,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    return "scheduled";
  } catch (error) {
    console.warn("[reminder] 通知を予約できませんでした:", error);
    return "failed";
  }
}
