# make-fun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/arunanala65-spec/make-fun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/arunanala65-spec/make-fun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (model radar-2): every pre-token DeFi protocol in the 14 November 2026 snapshot, ranked by what its token would be worth — from its TVL, its seven-day growth, how long it has run with no token, and how many chains it lives on — with a concrete seven-step farm plan for each one. The board covers all 40 watchlist protocols and every other rankable pre-token protocol below the floor, and the dashboard keeps the protocols whose token already trades apart in a Live view at the market's own values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The program reads the sealed snapshot, writes the ranked board to `out/board.json`, the dashboard's data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json` — the summary the judge reads. It runs on Node 22, standard library only, with no network. Two runs write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ce51ph37&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
