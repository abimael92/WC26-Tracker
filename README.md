# FIFA 2026 World Cup Bracket & Group Stage Simulator

A high-fidelity client-side tournament simulator built with React + Vite + TailwindCSS + Framer Motion + Zustand.

## Features

- Full 48-team format with 12 groups (A-L)
- Live group standings and editable match scores
- Auto-simulate groups with strength-weighted score generation
- Top 2 + best 8 third-place team qualification logic
- Full knockout path: Round of 32 → Round of 16 → Quarterfinals → Semifinals → 3rd Place → Final
- Winner propagation across rounds with animated UI
- Champion celebration overlay with confetti/trophy animation
- Responsive layout for mobile/tablet/desktop
- Local persistence with Zustand `persist`
- Bonus features:
  - Sound cue on winner selection (Web Audio API)
  - Dark/light mode toggle
  - Share bracket as image using `html2canvas`

## Stack

- React 18
- Vite 5
- TailwindCSS 3
- Framer Motion
- Zustand
- html2canvas

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Project structure

```text
fifa-2026-simulator/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src
    ├── App.jsx
    ├── index.css
    ├── main.jsx
    ├── components
    │   ├── BracketView.jsx
    │   ├── ChampionOverlay.jsx
    │   ├── GroupStage.jsx
    │   └── TeamPill.jsx
    ├── data
    │   └── teams.js
    ├── lib
    │   └── tournament.js
    └── store
        └── useTournamentStore.js
```
