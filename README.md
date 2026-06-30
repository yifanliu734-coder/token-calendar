# Token Calendar

A calendar heatmap for your Claude / LLM token spend. See how much you burn each day at a glance — import your Anthropic Console CSV and you're done.

**One single HTML file. No backend. No tracking. Your data never leaves the browser.**

🔗 **[Live demo →](https://yifanliu734-coder.github.io/token-calendar/)**

![Token Calendar screenshot](screenshots/cover.png)

## Why

I kept losing track of how much I was spending on Claude Code. The Anthropic Console shows you a number, but not the *shape* of your usage — which days you went heavy, when costs spiked, which models ate the budget. So I built a GitHub-contributions-style heatmap for it.

## Features

- 📅 **Calendar heatmap** — daily token volume or cost, color-graded so spikes jump out
- 📊 **Day / Week / Month / Year** views with totals, daily average, peak day, longest streak
- 🤖 **Per-model breakdown** — see which models drove each day's spend
- 📥 **One-step import** — Anthropic Console CSV, plain JSON, or a 3-column CSV (`date,tokens,cost`)
- 🌗 **Dark / light + accent color** themes
- 🌐 **English / 中文** built in
- 🖼️ **Share poster** — export a clean image of your month
- 🔒 **100% local** — everything lives in `localStorage`, nothing is uploaded

## Usage

**Option A — just open it**
Download `index.html` and double-click. That's it.

**Option B — use the hosted version**
Go to the [live demo](https://yifanliu734-coder.github.io/token-calendar/).

**Import your real data**
1. Anthropic Console → Usage → export CSV
2. In Token Calendar, tap the import button
3. Drop the CSV (or paste JSON / `date,tokens,cost`) → Merge

The demo data is fake — clear it and import your own to see real numbers.

## Share your month

Tap the share button to export a poster of your month — with a QR code linking back to the tool.

<img src="screenshots/share.png" width="300" alt="Share poster with QR code">

## Tech

Vanilla HTML/CSS/JS in a single file. No build step, no dependencies, no server. Roughly 1,600 lines you can read top to bottom.

## License

MIT — do whatever you want.

---

Built with [Claude Code](https://claude.com/claude-code). If this is useful, a ⭐ helps.
