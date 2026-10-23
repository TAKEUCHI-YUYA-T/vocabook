import {
  REMINDER_BODY,
  REMINDER_CHANNEL_ID,
  REMINDER_HOUR,
  REMINDER_ID,
  REMINDER_MINUTE,
  REMINDER_TITLE,
  scheduleDailyReminder,
} from "../reminder";

type Fake = Parameters<typeof scheduleDailyReminder>[0] & object;

/** 通知の部品の代わり。呼ばれた内容を記録する */
const fakeNotifications = (permission: { granted: boolean; canAskAgain: boolean }, afterRequest = { granted: true, canAskAgain: true }) => {
  const calls: string[] = [];
  const api = {
    getPermissionsAsync: jest.fn(async () => permission),
    requestPermissionsAsync: jest.fn(async () => {
      calls.push("request");
      return afterRequest;
    }),
    setNotificationChannelAsync: jest.fn(async () => {
      calls.push("channel");
      return null;
    }),
    cancelScheduledNotificationAsync: jest.fn(async () => {
      calls.push("cancel");
    }),
    scheduleNotificationAsync: jest.fn(async () => {
      calls.push("schedule");
      return REMINDER_ID;
    }),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DAILY: "daily" },
  };
  return { api: api as unknown as Fake, mocks: api, calls };
};

describe("毎朝の学習のリマインダー", () => {
  it("許可されていれば、毎日 8:00 に、決まった文面の通知を予約する", async () => {
    const { api, mocks } = fakeNotifications({ granted: true, canAskAgain: true });
    expect(await scheduleDailyReminder(api)).toBe("scheduled");
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REMINDER_ID,
      content: { title: REMINDER_TITLE, body: "継続は力なり！今日も学習を積み重ねよう！" },
      trigger: { type: "daily", hour: 8, minute: 0, channelId: REMINDER_CHANNEL_ID },
    });
    expect(REMINDER_BODY).toBe("継続は力なり！今日も学習を積み重ねよう！");
    expect([REMINDER_HOUR, REMINDER_MINUTE]).toEqual([8, 0]);
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled(); // すでに許可されているので、聞かない
  });

  it("先に同じ識別子の予約を取り消してから予約する（何度呼んでも、予約は1件だけ）", async () => {
    const { api, mocks, calls } = fakeNotifications({ granted: true, canAskAgain: true });
    await scheduleDailyReminder(api);
    await scheduleDailyReminder(api);
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    expect(calls).toEqual(["channel", "cancel", "schedule", "channel", "cancel", "schedule"]);
  });

  it("まだ許可がなければ、許可を求め、許可されたら予約する", async () => {
    const { api, mocks } = fakeNotifications({ granted: false, canAskAgain: true }, { granted: true, canAskAgain: true });
    expect(await scheduleDailyReminder(api)).toBe("scheduled");
    expect(mocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("許可されなければ（もう聞けない場合も）、予約せず、denied を返す", async () => {
    const asked = fakeNotifications({ granted: false, canAskAgain: true }, { granted: false, canAskAgain: false });
    expect(await scheduleDailyReminder(asked.api)).toBe("denied");
    expect(asked.mocks.scheduleNotificationAsync).not.toHaveBeenCalled();

    const blocked = fakeNotifications({ granted: false, canAskAgain: false });
    expect(await scheduleDailyReminder(blocked.api)).toBe("denied");
    expect(blocked.mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("通知の部品が無い版のアプリや、予約の失敗では、例外にしない", async () => {
    expect(await scheduleDailyReminder(null)).toBe("unavailable");
    const { api, mocks } = fakeNotifications({ granted: true, canAskAgain: true });
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error("boom"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(await scheduleDailyReminder(api)).toBe("failed");
    warn.mockRestore();
  });
});
