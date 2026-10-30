# Randminton

Randomly picks players from the waiting pool for the next badminton game when a court frees up.

## Rules (v1)

- **New session:** enter the number of courts and the list of players. Each player has a **name** and a **sex** (`F` or `M`). A pasted list uses one `name,sex` per line, e.g. `Ana,F`.
- **Past players:** every player is saved on the device with their sex, the date they last played and how many sessions they've played. On the New session screen, **Pick from past players** opens a list you can search and sort (recent first, most played, A–Z). Tap names to select them, or use **Select everyone from last session**. New names typed in are saved automatically.
- **First round:** randomly place `courts × 4` players on court, balanced by sex (see below). Everyone else waits, in random order.
- **When a court frees up:**
  - The player at **#1** in the waiting list always gets in.
  - The other **3** spots are drawn at random from the rest of the waiting list.
  - The 4 players who just finished **can't be drawn**, unless fewer than 4 people are waiting.
  - The players who just finished join the **end** of the waiting list.
- **Balance by sex:** each game tries to have the same number of women on both sides.
  - The draw prefers combinations that give an even number of women in the game (0, 2 or 4), picked at random among those. The #1 rule and the just-finished rule still apply first.
  - If the waiting list can't give an even number, the draw stays random and the sides are split as evenly as possible (e.g. 1 woman: she goes on one side).
  - With 2 women in a game, they're on opposite sides (mixed doubles). With 0 or 4, the split is random.
- **Guarantee:** the list always moves forward, so with 8 waiting the longest anyone waits is 3 games.

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

## Next steps

- [ ] Add the other requirements
- [x] Create the GitHub repo: https://github.com/jcwan-dev/randminton (public)
- [ ] Build the app (works in a phone browser, saves the session on the device) and host it on GitHub Pages
