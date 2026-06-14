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

const CITY_INFO_BY_NAME = Object.fromEntries(HOST_CITIES.map((cityInfo) => [cityInfo.city, cityInfo]));

const getCityInfo = (city) => {
  const cityInfo = CITY_INFO_BY_NAME[city];
  if (!cityInfo) throw new Error(`Sede desconocida en el calendario: ${city}`);
  return cityInfo;
};

export const GROUP_STAGE_START = {
  year: 2026,
  month: 6,
  day: 11,
};

export const GROUP_STAGE_MATCHES_PER_DAY = 4;
export const GROUP_STAGE_HOURS = [12, 15, 18, 21];
export const GROUP_STAGE_TOTAL_MATCHES = 72;
export const GROUP_STAGE_MATCH_COUNTS_BY_DAY = [2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6];
export const GROUP_STAGE_HOURS_BY_MATCH_COUNT = {
  2: [14, 20],
  4: [12, 15, 18, 21],
  6: [12, 14, 16, 18, 20, 22],
};

const buildGroupStageSchedule = () => {
  const groupStageByDate = [
    { month: 6, day: 11, matches: [{ matchId: 'A-1', city: 'Mexico City' }, { matchId: 'A-2', city: 'Guadalajara' }] },
    { month: 6, day: 12, matches: [{ matchId: 'B-1', city: 'Toronto' }, { matchId: 'D-1', city: 'Los Angeles' }] },
    { month: 6, day: 13, matches: [{ matchId: 'C-2', city: 'Boston' }, { matchId: 'D-2', city: 'Vancouver' }, { matchId: 'C-1', city: 'New York/New Jersey' }, { matchId: 'B-2', city: 'San Francisco' }] },
    { month: 6, day: 14, matches: [{ matchId: 'E-2', city: 'Philadelphia' }, { matchId: 'E-1', city: 'Houston' }, { matchId: 'F-1', city: 'Dallas' }, { matchId: 'F-2', city: 'Monterrey' }] },
    { month: 6, day: 15, matches: [{ matchId: 'H-2', city: 'Miami' }, { matchId: 'H-1', city: 'Atlanta' }, { matchId: 'G-2', city: 'Los Angeles' }, { matchId: 'G-1', city: 'Seattle' }] },
    { month: 6, day: 16, matches: [{ matchId: 'I-1', city: 'New York/New Jersey' }, { matchId: 'I-2', city: 'Boston' }, { matchId: 'J-1', city: 'Kansas City' }, { matchId: 'J-2', city: 'San Francisco' }] },
    { month: 6, day: 17, matches: [{ matchId: 'L-2', city: 'Toronto' }, { matchId: 'L-1', city: 'Dallas' }, { matchId: 'K-1', city: 'Houston' }, { matchId: 'K-2', city: 'Mexico City' }] },
    { month: 6, day: 18, matches: [{ matchId: 'A-4', city: 'Atlanta' }, { matchId: 'B-4', city: 'Los Angeles' }, { matchId: 'B-3', city: 'Vancouver' }, { matchId: 'A-3', city: 'Guadalajara' }] },
    { month: 6, day: 19, matches: [{ matchId: 'C-3', city: 'Philadelphia' }, { matchId: 'C-4', city: 'Boston' }, { matchId: 'D-4', city: 'San Francisco' }, { matchId: 'D-3', city: 'Seattle' }] },
    { month: 6, day: 20, matches: [{ matchId: 'E-3', city: 'Toronto' }, { matchId: 'E-4', city: 'Kansas City' }, { matchId: 'F-3', city: 'Houston' }, { matchId: 'F-4', city: 'Monterrey' }] },
    { month: 6, day: 21, matches: [{ matchId: 'H-4', city: 'Miami' }, { matchId: 'H-3', city: 'Atlanta' }, { matchId: 'G-3', city: 'Los Angeles' }, { matchId: 'G-4', city: 'Vancouver' }] },
    { month: 6, day: 22, matches: [{ matchId: 'I-4', city: 'New York/New Jersey' }, { matchId: 'I-3', city: 'Philadelphia' }, { matchId: 'J-3', city: 'Dallas' }, { matchId: 'J-4', city: 'San Francisco' }] },
    { month: 6, day: 23, matches: [{ matchId: 'L-3', city: 'Boston' }, { matchId: 'L-4', city: 'Toronto' }, { matchId: 'K-3', city: 'Houston' }, { matchId: 'K-4', city: 'Guadalajara' }] },
    { month: 6, day: 24, matches: [{ matchId: 'C-5', city: 'Miami' }, { matchId: 'C-6', city: 'Atlanta' }, { matchId: 'B-5', city: 'Vancouver' }, { matchId: 'B-6', city: 'Seattle' }, { matchId: 'A-5', city: 'Mexico City' }, { matchId: 'A-6', city: 'Monterrey' }] },
    { month: 6, day: 25, matches: [{ matchId: 'E-6', city: 'Philadelphia' }, { matchId: 'E-5', city: 'New York/New Jersey' }, { matchId: 'F-6', city: 'Dallas' }, { matchId: 'F-5', city: 'Kansas City' }, { matchId: 'D-5', city: 'Los Angeles' }, { matchId: 'D-6', city: 'San Francisco' }] },
    { month: 6, day: 26, matches: [{ matchId: 'I-5', city: 'Boston' }, { matchId: 'I-6', city: 'Toronto' }, { matchId: 'G-6', city: 'Seattle' }, { matchId: 'G-5', city: 'Vancouver' }, { matchId: 'H-6', city: 'Houston' }, { matchId: 'H-5', city: 'Guadalajara' }] },
    { month: 6, day: 27, matches: [{ matchId: 'L-5', city: 'New York/New Jersey' }, { matchId: 'L-6', city: 'Philadelphia' }, { matchId: 'J-6', city: 'Kansas City' }, { matchId: 'J-5', city: 'Dallas' }, { matchId: 'K-5', city: 'Miami' }, { matchId: 'K-6', city: 'Atlanta' }] },
  ];

  return groupStageByDate.flatMap((entry, dayIdx) =>
    entry.matches.map((match, matchIdx) => {
      const cityInfo = getCityInfo(match.city);
      const slotHour = GROUP_STAGE_HOURS_BY_MATCH_COUNT[entry.matches.length][matchIdx] ?? 18;
      const kickoffDate = zonedTimeToDate(GROUP_STAGE_START.year, entry.month, entry.day, slotHour, 0, cityInfo.timeZone);
      const [groupId, matchNumberText] = match.matchId.split('-');
      const matchNumberInGroup = Number(matchNumberText);
      const globalMatchNumber = groupStageByDate
        .slice(0, dayIdx)
        .reduce((sum, dateEntry) => sum + dateEntry.matches.length, 0) + matchIdx + 1;

      return {
        id: `groups-${globalMatchNumber}`,
        roundKey: 'groups',
        matchNumber: globalMatchNumber,
        groupId,
        matchId: match.matchId,
        matchNumberInGroup,
        kickoffUtc: kickoffDate.toISOString(),
        sourceTimeZone: cityInfo.timeZone,
        city: cityInfo.city,
        country: cityInfo.country,
        venue: cityInfo.venue,
        kickoffLabel: `${pad(slotHour)}:00`,
      };
    })
  );
};

const GROUP_STAGE_SCHEDULE = buildGroupStageSchedule();
const GROUP_STAGE_SCHEDULE_BY_MATCH_ID = Object.fromEntries(GROUP_STAGE_SCHEDULE.map((entry) => [entry.matchId, entry]));

const buildRoundSchedule = ({ roundKey, matches }) => {
  return matches.map((match, index) => {
    const cityInfo = getCityInfo(match.city);
    const localHour = match.hour;
    const isoLocal = createIsoInTimeZone(2026, match.month, match.day, localHour);
    const kickoffDate = zonedTimeToDate(2026, match.month, match.day, localHour, 0, cityInfo.timeZone);

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
    matches: [
      { month: 6, day: 28, hour: 18, city: 'Los Angeles' },
      { month: 6, day: 29, hour: 12, city: 'Boston' },
      { month: 6, day: 29, hour: 16, city: 'Monterrey' },
      { month: 6, day: 29, hour: 20, city: 'Houston' },
      { month: 6, day: 30, hour: 12, city: 'New York/New Jersey' },
      { month: 6, day: 30, hour: 16, city: 'Dallas' },
      { month: 6, day: 30, hour: 20, city: 'Mexico City' },
      { month: 7, day: 1, hour: 12, city: 'Atlanta' },
      { month: 7, day: 1, hour: 16, city: 'San Francisco' },
      { month: 7, day: 1, hour: 20, city: 'Seattle' },
      { month: 7, day: 2, hour: 12, city: 'Toronto' },
      { month: 7, day: 2, hour: 16, city: 'Los Angeles' },
      { month: 7, day: 2, hour: 20, city: 'Vancouver' },
      { month: 7, day: 3, hour: 12, city: 'Miami' },
      { month: 7, day: 3, hour: 16, city: 'Kansas City' },
      { month: 7, day: 3, hour: 20, city: 'Dallas' },
    ],
  }),
  r16: buildRoundSchedule({
    roundKey: 'r16',
    matches: [
      { month: 7, day: 4, hour: 14, city: 'Philadelphia' },
      { month: 7, day: 4, hour: 20, city: 'Houston' },
      { month: 7, day: 5, hour: 14, city: 'New York/New Jersey' },
      { month: 7, day: 5, hour: 20, city: 'Mexico City' },
      { month: 7, day: 6, hour: 14, city: 'Dallas' },
      { month: 7, day: 6, hour: 20, city: 'Seattle' },
      { month: 7, day: 7, hour: 14, city: 'Atlanta' },
      { month: 7, day: 7, hour: 20, city: 'Vancouver' },
    ],
  }),
  qf: buildRoundSchedule({
    roundKey: 'qf',
    matches: [
      { month: 7, day: 9, hour: 19, city: 'Boston' },
      { month: 7, day: 10, hour: 19, city: 'Los Angeles' },
      { month: 7, day: 11, hour: 16, city: 'Miami' },
      { month: 7, day: 11, hour: 20, city: 'Kansas City' },
    ],
  }),
  sf: buildRoundSchedule({
    roundKey: 'sf',
    matches: [
      { month: 7, day: 14, hour: 19, city: 'Dallas' },
      { month: 7, day: 15, hour: 19, city: 'Atlanta' },
    ],
  }),
  third: buildRoundSchedule({
    roundKey: 'third',
    matches: [{ month: 7, day: 18, hour: 16, city: 'Miami' }],
  }),
  final: buildRoundSchedule({
    roundKey: 'final',
    matches: [{ month: 7, day: 19, hour: 18, city: 'New York/New Jersey' }],
  }),
};

export const getMatchSchedule = (roundKey, matchIndex) => SCHEDULE_BY_ROUND[roundKey]?.[matchIndex] ?? null;

export const getAllScheduleRows = () =>
  ['r32', 'r16', 'qf', 'sf', 'third', 'final'].flatMap((roundKey) => SCHEDULE_BY_ROUND[roundKey]);

export const getGroupMatchSchedule = (groupId, matchIndex) => {
  if (!groupId || typeof matchIndex !== 'number') return null;
  const matchId = `${groupId}-${matchIndex + 1}`;
  return GROUP_STAGE_SCHEDULE_BY_MATCH_ID[matchId] ?? null;
};

export const getGroupMatchScheduleById = (matchId) => GROUP_STAGE_SCHEDULE_BY_MATCH_ID[matchId] ?? null;

export const getAllGroupScheduleRows = () => GROUP_STAGE_SCHEDULE;

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
