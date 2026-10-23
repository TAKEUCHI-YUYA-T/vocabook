/** 端末の時刻での、今日の日付（"YYYY-MM-DD"）。学習の記録の「今日」を決める */
export function localDay(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
