const HOST_CITIES = [
  { city: 'Los Angeles', country: 'USA', timeZone: 'America/Los_Angeles', venue: 'SoFi Stadium' },
  { city: 'Seattle', country: 'USA', timeZone: 'America/Los_Angeles', venue: 'Lumen Field' },
  { city: 'Vancouver', country: 'Canada', timeZone: 'America/Vancouver', venue: 'BC Place' },
  { city: 'San Francisco', country: 'USA', timeZone: 'America/Los_Angeles', venue: 'Levi\'s Stadium' },
  { city: 'Dallas', country: 'USA', timeZone: 'America/Chicago', venue: 'AT&T Stadium' },
  { city: 'Houston', country: 'USA', timeZone: 'America/Chicago', venue: 'NRG Stadium' },
  { city: 'Kansas City', country: 'USA', timeZone: 'America/Chicago', venue: 'Arrowhead Stadium' },
  { city: 'Atlanta', country: 'USA', timeZone: 'America/New_York', venue: 'Mercedes-Benz Stadium' },
  { city: 'Miami', country: 'USA', timeZone: 'America/New_York', venue: 'Hard Rock Stadium' },
  { city: 'Boston', country: 'USA', timeZone: 'America/New_York', venue: 'Gillette Stadium' },
  { city: 'Philadelphia', country: 'USA', timeZone: 'America/New_York', venue: 'Lincoln Financial Field' },
  { city: 'New York/New Jersey', country: 'USA', timeZone: 'America/New_York', venue: 'MetLife Stadium' },
  { city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto', venue: 'BMO Field' },
  { city: 'Monterrey', country: 'Mexico', timeZone: 'America/Monterrey', venue: 'Estadio BBVA' },
  { city: 'Guadalajara', country: 'Mexico', timeZone: 'America/Mexico_City', venue: 'Estadio Akron' },
  { city: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City', venue: 'Estadio Azteca' },
];

const pad = (value) => String(value).padStart(2, '0');

const createIsoInTimeZone = (year, month, day, hour, minute = 0) => {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
};

const getPartsInZone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
};

const zonedTimeToDate = (year, month, day, hour, minute, timeZone) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const zoned = getPartsInZone(new Date(utcGuess), timeZone);
  const zonedUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  const offsetMs = zonedUtc - utcGuess;
  return new Date(utcGuess - offsetMs);
};

const r32DateByIndex = [13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 17, 17];
const r32HourByIndex = [12, 15, 18, 21, 12, 15, 18, 21, 12, 15, 18, 21, 12, 18, 15, 21];

const buildRoundSchedule = ({ roundKey, totalMatches, dateByIndex, hourByIndex, fixedVenue }) => {
  return Array.from({ length: totalMatches }, (_, index) => {
    const cityInfo = fixedVenue || HOST_CITIES[index % HOST_CITIES.length];
    const localDate = dateByIndex(index);
    const localHour = hourByIndex(index);
    const isoLocal = createIsoInTimeZone(2026, localDate.month, localDate.day, localHour);
    const kickoffDate = zonedTimeToDate(2026, localDate.month, localDate.day, localHour, 0, cityInfo.timeZone);

    return {
      id: `${roundKey}-${index + 1}`,
      roundKey,
      matchNumber: index + 1,
      isoLocal,
      kickoffUtc: kickoffDate.toISOString(),
      sourceTimeZone: cityInfo.timeZone,
      city: cityInfo.city,
      country: cityInfo.country,
      venue: cityInfo.venue,
      kickoffLabel: `${pad(localHour)}:00`,
    };
  });
};

const SCHEDULE_BY_ROUND = {
  r32: buildRoundSchedule({
    roundKey: 'r32',
    totalMatches: 16,
    dateByIndex: (index) => ({ month: 6, day: r32DateByIndex[index] }),
    hourByIndex: (index) => r32HourByIndex[index],
  }),
  r16: buildRoundSchedule({
    roundKey: 'r16',
    totalMatches: 8,
    dateByIndex: (index) => ({ month: 6, day: 19 + Math.floor(index / 2) }),
    hourByIndex: (index) => [12, 20][index % 2],
  }),
  qf: buildRoundSchedule({
    roundKey: 'qf',
    totalMatches: 4,
    dateByIndex: (index) => ({ month: 6, day: 25 + Math.floor(index / 2) }),
    hourByIndex: (index) => [15, 19][index % 2],
  }),
  sf: buildRoundSchedule({
    roundKey: 'sf',
    totalMatches: 2,
    dateByIndex: (index) => ({ month: 6, day: 29 + index }),
    hourByIndex: () => 19,
  }),
  third: buildRoundSchedule({
    roundKey: 'third',
    totalMatches: 1,
    dateByIndex: () => ({ month: 7, day: 18 }),
    hourByIndex: () => 16,
  }),
  final: buildRoundSchedule({
    roundKey: 'final',
    totalMatches: 1,
    dateByIndex: () => ({ month: 7, day: 19 }),
    hourByIndex: () => 18,
    fixedVenue: {
      city: 'New York/New Jersey',
      country: 'USA',
      timeZone: 'America/New_York',
      venue: 'MetLife Stadium',
    },
  }),
};

export const getMatchSchedule = (roundKey, matchIndex) => SCHEDULE_BY_ROUND[roundKey]?.[matchIndex] ?? null;

export const getAllScheduleRows = () =>
  ['r32', 'r16', 'qf', 'sf', 'third', 'final'].flatMap((roundKey) => SCHEDULE_BY_ROUND[roundKey]);

export const formatMatchScheduleLocal = (scheduleEntry) => {
  if (!scheduleEntry) return null;

  const date = new Date(scheduleEntry.kickoffUtc);
  const dateText = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timeText = new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);

  return {
    dateText,
    timeText,
  };
};
