import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstRound, nextGame, pickBalanced, replacePlayer, splitTeams, women, maxWait, shuffle } from '../src/draw.js';

// Small seeded generator so failures can be replayed.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roster = spec => spec.split(' ').map((s, i) => ({ id: `p${i}`, name: `${s}${i}`, sex: s }));
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

test('two women in a game go on opposite sides', () => {
  const four = roster('F F M M');
  for (const seed of SEEDS) {
    const [a, b] = splitTeams(four, seeded(seed));
    assert.equal(women(a), 1);
    assert.equal(women(b), 1);
  }
});

test('sides are never more than 1 woman apart', () => {
  for (const spec of ['F M M M', 'F F F M', 'F F F F', 'M M M M']) {
    for (const seed of SEEDS.slice(0, 30)) {
      const [a, b] = splitTeams(roster(spec), seeded(seed));
      assert.ok(Math.abs(women(a) - women(b)) <= 1, spec);
    }
  }
});

test('pickBalanced gives an even number of women when the pool allows it', () => {
  const pool = roster('F M M M M M');
  const fixed = roster('F');
  for (const seed of SEEDS) {
    const pick = pickBalanced(fixed, pool, 3, seeded(seed));
    assert.equal(pick.length, 3);
    assert.equal((women(fixed) + women(pick)) % 2, 0);
  }
});

test('pickBalanced still picks when balance is impossible', () => {
  const pool = roster('M M M M');
  const pick = pickBalanced(roster('F'), pool, 3, seeded(1));
  assert.equal(pick.length, 3);
});

test('next game: #1 always plays, just-finished sit out and join the end', () => {
  const players = roster('F M F M F M F M F M F M');
  for (const seed of SEEDS) {
    const rng = seeded(seed);
    const queue = shuffle(players.slice(0, 8), rng);
    const finished = players.slice(8);
    const game = nextGame(queue, finished, rng);
    assert.equal(game.players[0], queue[0]);
    assert.equal(game.players.length, 4);
    assert.ok(game.players.every(p => !finished.includes(p)));
    assert.deepEqual(new Set(game.queue.slice(-4)), new Set(finished));
    assert.equal(game.queue.length, 8);
  }
});

test('next game balances women when the waiting list allows it', () => {
  const players = roster('M F M F M M M M M M M M');
  for (const seed of SEEDS) {
    const rng = seeded(seed);
    const game = nextGame(players.slice(0, 8), players.slice(8), rng);
    const [a, b] = game.teams;
    assert.equal(women(a), women(b));
  }
});

test('fewer than 4 waiting: just-finished players fill the spots', () => {
  const players = roster('F M F M F M');
  const game = nextGame(players.slice(0, 2), players.slice(2), seeded(3));
  assert.ok(game.players.includes(players[0]) && game.players.includes(players[1]));
  assert.equal(game.players.length, 4);
  assert.equal(game.queue.length, 2);
  assert.equal(nextGame(players.slice(0, 1), players.slice(1, 3), seeded(3)), null);
});

test('first round: every court is balanced when possible and nobody is lost', () => {
  for (const spec of ['F M F M F M F M F M F M F M F M F M F M F M F M', 'F F F M M M M M M M M M M M M M M M F M M']) {
    const players = roster(spec);
    for (const seed of SEEDS.slice(0, 50)) {
      const { courts, queue } = firstRound(players, 4, seeded(seed));
      assert.equal(courts.length, Math.min(4, Math.floor(players.length / 4)));
      for (const { teams: [a, b] } of courts) assert.equal(women(a), women(b), spec);
      const everyone = [...courts.flatMap(c => c.teams.flat()), ...queue];
      assert.equal(new Set(everyone).size, players.length);
    }
  }
});

test('first round with an odd number of women and nobody waiting still fills every court', () => {
  const players = roster('F M M M M M M M');
  const { courts, queue } = firstRound(players, 2, seeded(5));
  assert.equal(courts.length, 2);
  assert.equal(queue.length, 0);
});

test('replacing a missing player keeps the balance', () => {
  const players = roster('F M F M F M F M F M F M');
  for (const seed of SEEDS) {
    const rng = seeded(seed);
    const finished = players.slice(8);
    const game = { ...nextGame(players.slice(0, 8), finished, rng), finished };
    const missing = game.players[1];
    const sameSexFree = game.queue.some(p => !finished.includes(p) && p.sex === missing.sex);
    const next = replacePlayer(game, missing, rng);
    assert.ok(!next.players.includes(missing));
    assert.ok(next.players.every(p => !finished.includes(p)));
    const gap = Math.abs(women(next.teams[0]) - women(next.teams[1]));
    assert.equal(gap, sameSexFree ? 0 : 1);
    assert.equal(next.queue.length, 7);
  }
});

test('nobody sits out more than maxWait games in a row', () => {
  const players = roster('F M F M F F M M F M M M F M F M F M M F M F M M');
  const rng = seeded(42);
  const { courts, queue: start } = firstRound(players, 4, rng);
  let onCourt = courts.map(c => c.teams.flat());
  let queue = start;
  const sat = new Map(players.map(p => [p, 0]));
  let worst = 0;
  for (let g = 0; g < 5000; g++) {
    const c = Math.floor(rng() * onCourt.length);
    const game = nextGame(queue, onCourt[c], rng);
    for (const p of queue) {
      if (game.players.includes(p)) sat.set(p, 0);
      else {
        sat.set(p, sat.get(p) + 1);
        worst = Math.max(worst, sat.get(p));
      }
    }
    onCourt[c] = game.players;
    queue = game.queue;
  }
  assert.ok(worst <= maxWait(8), `worst ${worst}`);
});
