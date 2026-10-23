/** 端末の時刻での、今日の日付（"YYYY-MM-DD"）。学習の記録の「今日」を決める */
export function localDay(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 今日を最後とする、count 日分の日付（古い順）。月や年をまたいでも、暦どおりに数える */
export function lastDays(count: number, today: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - i))));
}
