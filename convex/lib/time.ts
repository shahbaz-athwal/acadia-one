const AMPM_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/;
const TIME_24H_REGEX = /^(\d{1,2}):(\d{2})$/;

export function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const ampmMatch = trimmed.match(AMPM_REGEX);
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1], 10);
    const minutes = Number.parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toLowerCase().replace(/\./g, "");

    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
      return null;
    }

    if (period === "pm" && hours !== 12) {
      hours += 12;
    }
    if (period === "am" && hours === 12) {
      hours = 0;
    }
    if (hours < 0 || hours > 23) {
      return null;
    }
    return hours * 60 + minutes;
  }

  const match24 = trimmed.match(TIME_24H_REGEX);
  if (match24) {
    const hours = Number.parseInt(match24[1], 10);
    const minutes = Number.parseInt(match24[2], 10);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }
    return hours * 60 + minutes;
  }

  return null;
}
