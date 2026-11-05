/**
 * Time Slot Utilities for Provider Availability & Double-Booking Prevention
 * Provides canonical normalization, 12h/24h parsing, minutes-from-midnight conversion,
 * interval overlap calculation, and discrete slot tick generation.
 */

/**
 * Parse any valid time string into minutes from midnight (0 - 1439).
 * Supports:
 * - 12-hour formats: "5:00 PM", "5:00pm", "05:00 PM", "5 PM", "12:00 AM", "12:30 PM"
 * - 24-hour formats: "17:00", "09:30", "9:30", "0:00", "23:59"
 * Returns null if string cannot be parsed.
 */
const parseTimeToMinutes = (timeStr) => {
  if (typeof timeStr !== 'string') return null;
  const s = timeStr.trim();
  if (!s || s.toUpperCase() === 'ASAP') return null;

  // 1. 12-hour format with AM/PM (e.g., "5:00 PM", "05:30 pm", "5 PM", "12:15 AM")
  const match12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const modifier = match12[3].toUpperCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    if (hours === 12) {
      hours = modifier === 'AM' ? 0 : 12;
    } else if (modifier === 'PM') {
      hours += 12;
    }
    return hours * 60 + minutes;
  }

  // 2. 24-hour format (e.g., "17:00", "09:30", "9:30")
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  // 3. Simple hour only format (e.g., "17", "9")
  const matchHour = s.match(/^(\d{1,2})$/);
  if (matchHour) {
    const hours = parseInt(matchHour[1], 10);
    if (hours >= 0 && hours <= 23) {
      return hours * 60;
    }
  }

  return null;
};

/**
 * Convert minutes from midnight (0 - 1439) into 24-hour "HH:mm" format.
 */
const minutesToHHmm = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '';
  const clamped = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Normalize scheduledTimeSlot input into canonical format.
 * If endTime is missing or equal to/before startTime, computes endTime using defaultDurationMinutes.
 */
const normalizeTimeSlot = (timeSlot, defaultDurationMinutes = 60) => {
  if (!timeSlot || typeof timeSlot !== 'object') {
    return null;
  }

  const rawStart = timeSlot.startTime || '';
  const rawEnd = timeSlot.endTime || '';

  const startMinutes = parseTimeToMinutes(rawStart);
  if (startMinutes === null) {
    return null;
  }

  let endMinutes = parseTimeToMinutes(rawEnd);
  if (endMinutes === null || endMinutes <= startMinutes) {
    endMinutes = Math.min(1439, startMinutes + defaultDurationMinutes);
  }

  return {
    startTime: minutesToHHmm(startMinutes),
    endTime: minutesToHHmm(endMinutes),
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes,
    rawStartTime: rawStart,
    rawEndTime: rawEnd
  };
};

/**
 * Check if two time intervals [s1, e1) and [s2, e2) overlap.
 * Strictly checks: s1 < e2 && e1 > s2.
 * Adjoining intervals (e.g. 17:00-18:00 and 18:00-19:00) do NOT overlap.
 */
const doIntervalsOverlap = (s1, e1, s2, e2) => {
  return s1 < e2 && e1 > s2;
};

/**
 * Generate 5-minute reservation tick strings between startMinutes and endMinutes.
 * E.g. [1020, 1080) (17:00 to 18:00) generates 12 ticks:
 * ['17:00', '17:05', '17:10', '17:15', '17:20', '17:25', '17:30', '17:35', '17:40', '17:45', '17:50', '17:55']
 */
const generateSlotTicks = (startMinutes, endMinutes, tickMinutes = 5) => {
  const ticks = [];
  const start = Math.floor(startMinutes / tickMinutes) * tickMinutes;
  for (let m = start; m < endMinutes; m += tickMinutes) {
    ticks.push(minutesToHHmm(m));
  }
  return ticks;
};

/**
 * Format a Date object or ISO string to canonical 'YYYY-MM-DD' date string.
 */
const formatDateToDateStr = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

module.exports = {
  parseTimeToMinutes,
  minutesToHHmm,
  normalizeTimeSlot,
  doIntervalsOverlap,
  generateSlotTicks,
  formatDateToDateStr
};
