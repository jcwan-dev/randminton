// Everything is saved in this browser only (localStorage).
const KEYS = {
  session: 'randminton.session',
  draft: 'randminton.draft',
  roster: 'randminton.roster'
};

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working for this visit.
  }
}

// The live session: { players: { id: player }, nextId, courts: [{ teams, startedAt }], queue, onBreak, games }
export const loadSession = () => read(KEYS.session, null);
export const saveSession = session => write(KEYS.session, session);

// The New session screen as it was left: { courts, players: [{ name, sex }], sex }
export const loadDraft = () => ({ courts: 4, players: [], sex: 'F', ...read(KEYS.draft, {}) });
export const saveDraft = draft => write(KEYS.draft, draft);

// Past players by rosterKey(name): { name, sex, last: 'YYYY-MM-DD', count }
export const loadRoster = () => read(KEYS.roster, {});
export const saveRoster = roster => write(KEYS.roster, roster);

export const rosterKey = name => name.trim().toLowerCase();

// Records that these players played on `date`, once per day.
export function remember(roster, players, date) {
  for (const p of players) {
    const key = rosterKey(p.name);
    const old = roster[key];
    const count = (old?.count ?? 0) + (old?.last === date ? 0 : 1);
    roster[key] = { name: p.name, sex: p.sex, last: date, count };
  }
  return roster;
}
