# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/backburner036-prog/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/backburner036-prog/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Elang-7 Island Run — a 3-mission 2.5D flight game: ring runs, island-hop landings and a storm rescue against rival pilot Kirana, with fuel and damage decisions, over the fictional Nusa archipelago.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, plain static files.

## How to fly

- **W / S** — throttle up / down
- **↑ / ↓** — pitch down / up
- **← / →** — roll (bank to turn)
- **SPACE** — brake · **F** — flaps · **R** — restart the mission
- **Mouse** — click menu buttons, drag to steer

## Missions

1. **Ring Run** — fly all 8 rings in order against the clock. Beat Kirana's 2:30.
2. **Island Hop** — land on the runways of Pulau Api, Pulau Karang and Pulau Sawah.
3. **Storm Rescue** — reach the rescue beacon in a crosswind storm on 42% fuel.
4. **Free Flight** — no clock, no rival; explore the archipelago.

Flying rewards throttle and turn discipline: lift collapses into a stall when you are slow with the nose up, overspeed damages the airframe, and fuel burns with throttle. A soft landing repairs and refuels; a hard one costs damage; a crash ends the sortie with the reason on screen.

## Layout

- `game/index.html` + `game/src/` — the game (vanilla JS + Canvas 2D, no libraries): `config.js`, `flight.js` (physics), `world.js` (terrain, islands, runways, rings), `render.js` (chase view), `hud.js` (instruments), `input.js`, `missions.js` (campaign + rival), `audio.js` (WebAudio synth), `main.js` (loop + states)
- `main.ts` — hand-in program (Node 22, stdlib only): copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — 4 real renders of the game (see `shots.json`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=szf4tywk&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
