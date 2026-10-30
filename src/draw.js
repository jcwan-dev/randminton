// Rotation rules (see README). Players are { id, name, sex: 'F' | 'M' }.
// Every function takes an `rng` returning [0, 1) so tests can be repeatable.

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const women = players => players.filter(p => p.sex === 'F').length;

// Most games in a row someone can sit out, counting every game that starts while they're off court
// (the next game on their own court included). Each draw moves everyone up at least 1 place, so
// it's the length of the list they have to climb: 4 or fewer waiting, the finished players are in
// the draw straight away; more than 4, the next game on their court starts without them.
export const maxWait = waiting => Math.max(0, waiting <= 4 ? waiting : waiting - 3);

function combinations(list, k, start = 0, picked = [], out = []) {
  if (picked.length === k) {
    out.push(picked);
    return out;
  }
  for (let i = start; i <= list.length - (k - picked.length); i++) {
    combinations(list, k, i + 1, [...picked, list[i]], out);
  }
  return out;
}

// Picks k players from pool. Prefers picks that give the game (fixed + picked) an even
// number of women, so both sides can have the same; otherwise any pick. Uniform among the choices.
export function pickBalanced(fixed, pool, k, rng = Math.random) {
  if (k <= 0) return [];
  if (pool.length <= k) return [...pool];
  const all = combinations(pool, k);
  const even = all.filter(c => (women(fixed) + women(c)) % 2 === 0);
  const choices = even.length ? even : all;
  return choices[Math.floor(rng() * choices.length)];
}

// Splits 4 players into two sides. With 2 women they go on opposite sides;
// otherwise every split is as even as it can be, so it's random.
export function splitTeams(four, rng = Math.random) {
  const s = shuffle(four, rng);
  const f = s.filter(p => p.sex === 'F');
  const m = s.filter(p => p.sex !== 'F');
  if (f.length === 2 && m.length === 2) return [[f[0], m[0]], [f[1], m[1]]];
  return [s.slice(0, 2), s.slice(2, 4)];
}

// First round: fills as many courts as there are groups of 4, each with an even number of women
// when the player list allows it. Everyone else waits in random order.
export function firstRound(players, courtCount, rng = Math.random) {
  const n = Math.min(courtCount, Math.floor(players.length / 4));
  const s = shuffle(players, rng);
  const on = s.slice(0, n * 4);
  const off = s.slice(n * 4);
  if (women(on) % 2 === 1 && off.length) {
    // Swap with the first waiting player (random, as the list is shuffled) for one of the other sex.
    const j = on.findIndex(p => p.sex !== off[0].sex);
    [on[j], off[0]] = [off[0], on[j]];
  }
  // Pair women with women and men with men, then put two pairs on each court.
  const pairs = [];
  const f = on.filter(p => p.sex === 'F');
  const m = on.filter(p => p.sex !== 'F');
  for (const group of [f, m]) {
    for (let i = 0; i < group.length; i += 2) pairs.push(group.slice(i, i + 2));
  }
  // With an odd number of women (nobody to swap with), the last woman and man share a pair.
  const flat = shuffle(pairs.filter(p => p.length === 2), rng).flat();
  const odd = pairs.filter(p => p.length === 1).flat();
  const ordered = [...flat, ...odd];
  const courts = [];
  for (let c = 0; c < n; c++) courts.push({ teams: splitTeams(ordered.slice(c * 4, c * 4 + 4), rng) });
  return { courts, queue: off };
}

// With this many waiting, the players who just finished join the end of the list before the draw.
// Otherwise, with exactly 4 waiting, the same 4 would always play together.
export const finishedJoinFirst = waiting => waiting <= 4;

// A court frees up. `queue` is the waiting list in order, `finished` the 4 who just came off.
// Returns { players, teams, queue } with the new waiting list, or null if there aren't 4 players.
export function nextGame(queue, finished, rng = Math.random) {
  const joinFirst = finishedJoinFirst(queue.length);
  const list = joinFirst ? [...queue, ...shuffle(finished, rng)] : queue;
  if (list.length < 4) return null;
  const [first, ...rest] = list;
  const players = [first, ...pickBalanced([first], rest, 3, rng)];
  const remaining = list.filter(p => !players.includes(p));
  return {
    players,
    teams: splitTeams(players, rng),
    queue: joinFirst ? remaining : [...remaining, ...shuffle(finished, rng)]
  };
}

// Someone drawn for `game` isn't there. Takes a replacement from the new waiting list,
// keeping the balance where possible and avoiding players who just finished.
export function replacePlayer(game, missing, rng = Math.random) {
  const rest = game.players.filter(p => p !== missing);
  const fresh = game.queue.filter(p => !game.finished.includes(p));
  const pool = fresh.length ? fresh : game.queue;
  if (!pool.length) return null;
  const [sub] = pickBalanced(rest, pool, 1, rng);
  const players = [...rest, sub];
  return { players, teams: splitTeams(players, rng), queue: game.queue.filter(p => p !== sub) };
}
