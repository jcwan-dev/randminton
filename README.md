# Randminton

Randomly picks players from the waiting pool for the next badminton game when a court frees up.

## Rules (v1)

- **New session:** enter the number of courts and the list of players. Each player has a **name** and a **sex** (`F` or `M`). A pasted list uses one `name,sex` per line, e.g. `Ana,F`.
- **Past players:** every player is saved on the device with their sex, the date they last played and how many sessions they've played. On the New session screen, **Pick from past players** opens a list you can search and sort (recent first, most played, A–Z). Tap names to select them, or use **Select everyone from last session**. New names typed in are saved automatically.
- **First round:** randomly place `courts × 4` players on court, balanced by sex (see below). Everyone else waits, in random order.
- **When a court frees up:**
  - The player at **#1** in the waiting list always gets in.
  - The other **3** spots are drawn at random from the rest of the waiting list.
  - **More than 4 waiting:** the 4 players who just finished **can't be drawn**. They join the **end** of the waiting list after the draw.
  - **4 or fewer waiting:** the 4 players who just finished join the **end** of the waiting list **before** the draw, so they can be drawn. Without this, with exactly 4 waiting, the same 4 people would play together all session (unless two games end at the same moment).
- **Balance by sex:** each game tries to have the same number of women on both sides.
  - The draw prefers combinations that give an even number of women in the game (0, 2 or 4), picked at random among those. The #1 rule and the just-finished rule still apply first.
  - If the waiting list can't give an even number, the draw stays random and the sides are split as evenly as possible (e.g. 1 woman: she goes on one side).
  - With 2 women in a game, they're on opposite sides (mixed doubles). With 0 or 4, the split is random.
- **Guarantee:** the list always moves forward. Counting every game that starts while you're off court (the next game on your own court included), with `W` people waiting nobody sits out more than:
  - `W` games in a row when `W` is 4 or fewer
  - `W − 3` games in a row when `W` is more than 4 (8 waiting: at most 5, which is rare)

  The New session screen shows this number.

## Design

Design canvas (private, viewable in the browser): https://claude.ai/artifact/NaBpH8ZseSwpWTQCkAvS3U

Source in `design/`. Open the canvas link to see these files. They don't display when opened on their own.

| Screen | File |
| --- | --- |
| 1 · New session | `design/Main.dc.html` |
| 1b · Pick from past players | `design/PastPlayers.dc.html` |
| 2 · Live session (phone) | `design/Live.dc.html` |
| 3 · Court free → draw | `design/Draw.dc.html` |
| 4 · Courtside tablet view | `design/Courtside.dc.html` |
| Canvas layout | `design/canvas.json` |

Look: court green `#1F6B4A`, lime highlight `#C6F24E`, dark text `#12201A`, light background `#F4F6F3`. Fonts are Space Grotesk for headings and Inter for text.

### Assumptions to confirm

- Each game is split into two teams (2 vs 2), random apart from the sex balance.
- Sex is required for every player (no "unspecified" option).
- The 4 players coming off court join the end of the list in random order.
- Extra actions: add a late player, take a break, replace a missing player.

## Development

The app is plain HTML, CSS and JavaScript (ES modules), with no build step and no dependencies.

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css` | The page and its styles |
| `src/draw.js` | The rotation rules: first round, next game, sex balance, replacing a player |
| `src/store.js` | Saving the session, the New session draft and past players in the browser (`localStorage`) |
| `src/app.js` | The screens and what each button does |
| `test/draw.test.js` | Tests for the rules |

- **Run it:** `npm start`, then open the address it prints. (The page has to be served, it doesn't work opened as a file.)
- **Test it:** `npm test` (Node 20 or later).
- **Deploy:** every push to `main` runs the tests and publishes the site with GitHub Pages (`.github/workflows/pages.yml`). Pull requests run the tests only.

On a screen 900 px or wider (a tablet in landscape), the live session switches to the courtside layout: courts in a grid, waiting list on the side.

## Next steps

- [ ] Add the other requirements
- [x] Create the GitHub repo: https://github.com/jcwan-dev/randminton (public)
- [ ] Build the app (works in a phone browser, saves the session on the device) and host it on GitHub Pages: first version in progress
