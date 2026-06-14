# FIFA 2026 Simulator — Design Tokens & Contrast Handoff

## Purpose
This document maps the app's current visual tokens and provides accessible replacements for low-contrast text usage (WCAG 2.1 AA, normal text target: 4.5:1).

## Source Files
- `src/index.css`
- `tailwind.config.js`
- `src/App.jsx`
- `src/components/GroupStage.jsx`
- `src/components/BracketView.jsx`
- `src/components/TeamPill.jsx`
- `src/components/ChampionOverlay.jsx`
- `src/assets/trophy-center.svg`

## Core Theme Tokens

### Light (`.theme-light` / `.light-mode`)
- Backgrounds: `#F8FAFC`, `#FFFFFF`, `#F1F5F9`
- Text: `#0F172A`, `#334155`, `#64748B`
- Accent primary: `#15803D`
- Accent secondary: `#EA580C`
- Status: success `#15803D`, warning `#EA580C`, danger `#EF4444`, yellow card `#EAB308`
- Border/lines: `#CBD5E1`, `#94A3B8`

### Dark (`.theme-dark`)
- Backgrounds: `#09090B`, `#18181B`, `#111117`
- Text: `#FAFAFA`, `#D4D4D8`, `#A1A1AA`
- Accent primary: `#06B6D4`
- Accent secondary: `#EC4899`
- Status: success `#10B981`, warning `#06B6D4`, danger `#EF4444`, yellow card `#EAB308`
- Border/lines: `#2C2C34`, `#3F3F46`

## Contrast Findings (Current)

| Pair | Ratio | Result |
|---|---:|---|
| `#0F172A` on `#F8FAFC` | 17.06 | Pass |
| `#334155` on `#FFFFFF` | 10.35 | Pass |
| `#64748B` on `#F8FAFC` | 4.55 | Pass (borderline) |
| `#7D8EA8` on `#FFFFFF` | 3.33 | Fail (normal text) |
| `#EA580C` on `#F8FAFC` | 3.40 | Fail (normal text) |
| `#EF4444` on `#F8FAFC` | 3.60 | Fail (normal text) |
| `#EAB308` on `#F8FAFC` | 1.83 | Critical fail |
| `#FAFAFA` on `#09090B` | 19.06 | Pass |

## Recommended Accessible Replacement Tokens

These replacements preserve the existing hue direction while meeting or exceeding AA for normal text on light backgrounds.

| Usage Intent | Current | Proposed | Contrast on `#F8FAFC` |
|---|---|---|---:|
| Warning text (small/body) | `#EA580C` | `#C2410C` | 4.95 |
| Warning text (high-emphasis) | `#EA580C` | `#9A3412` | 6.98 |
| Danger text (small/body) | `#EF4444` | `#DC2626` | 4.62 |
| Danger text (high-emphasis) | `#EF4444` | `#B91C1C` | 6.18 |
| Yellow card text label | `#EAB308` | `#A16207` | 4.71 |
| Yellow card text (strong) | `#EAB308` | `#92400E` | 6.78 |
| Muted small label | `#7D8EA8` | `#64748B` | 4.55 |
| Muted small label (strong) | `#7D8EA8` | `#475569` | 7.24 |

## Practical Usage Rules
- Keep bright brand/status colors (`#EAB308`, `#EA580C`, `#EF4444`) for icon fills, chips, borders, and backgrounds.
- Use darker text variants for body/small labels on light surfaces.
- Reserve borderline token `#64748B` for medium+ type; use `#475569` for tiny metadata.
- In dark mode, current text contrast is generally strong and can remain as-is.

## Suggested Token Additions (`src/index.css`)

```css
:root {
  --warning-text-aa: #C2410C;
  --warning-text-strong: #9A3412;
  --danger-text-aa: #DC2626;
  --danger-text-strong: #B91C1C;
  --yellow-text-aa: #A16207;
  --yellow-text-strong: #92400E;
  --muted-text-aa: #64748B;
  --muted-text-strong: #475569;
}
```

## Priority Implementation Order
1. Replace yellow text usage on light surfaces first (`#EAB308` text).
2. Replace small warning/danger text on light surfaces.
3. Replace muted tiny metadata (`#7D8EA8`) where text size is `12px` or below.
4. Re-run contrast checks on all button/badge text states (default/hover/disabled).
