# Procrastinghost 👻

A to-do list that haunts you. Made for the ACM Long Beach Spooky Season Hackathon (Oct 2026).

## What it does

Every task has a timer. If you don't finish it before the timer runs out, the task "dies" and comes back as a ghost that floats around your screen.

The longer you ignore it, the worse it gets:

| Level | Name | What happens |
|---|---|---|
| 1 | Mildly spooky | Small ghost, polite reminders |
| 2 | Per my last haunting | Bigger, sounds like a work email |
| 3 | Not mad, just disappointed | Angry eyebrows, guilt trips |
| 4 | Full poltergeist | Huge, red, shaking, yells in caps, tints the whole screen |

When you click a ghost you can:
- **Exorcise it** – mark the task done, the ghost bursts into sparkles and goes to the Graveyard
- **Make an excuse** – the ghost shuts down your excuse and gets one level stronger
- **Snooze** – the ghost leaves for a bit but comes back one level angrier

## How to run

No install needed. Just open `index.html` in a browser.

Tip: pick **"Haunts in 30 sec (demo)"** when adding a task to see a ghost level up quickly.

## Built with

- HTML, CSS, vanilla JavaScript (no frameworks)
- SVG for the ghosts (face changes per level)
- `requestAnimationFrame` for the floating + bouncing movement
- `localStorage` so your ghosts are still there when you come back

## Files

```
index.html   – page layout
style.css    – all the styling + animations
script.js    – task logic, haunt levels, ghost movement
```

## Future ideas

- Spooky sound effects
- Ghosts that hide your other buttons
- Browser notifications when a new ghost spawns
- Leaderboard for most exorcisms
