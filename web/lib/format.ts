const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "17 Oct, 21:48" */
export const formatWhen = (iso: string) => dateTime.format(new Date(iso));
/** "21:48" */
export const formatTime = (iso: string) => time.format(new Date(iso));

/** "1h 52m" / "4m" until a time, "expired" once past. */
export function formatLeft(iso: string, now = new Date()): string {
  const mins = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "expired";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}
