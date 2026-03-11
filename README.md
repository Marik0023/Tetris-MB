# ✨ Magic Tetris

A magical, cosmic-themed Tetris game with local leaderboards, difficulty levels, and score card generation.

## Features

- 🎮 **Classic Tetris** with 7-bag randomizer, ghost piece, hold piece
- ⚡ **4 Difficulty Levels**: Easy / Medium / Hard / Expert
- 🏆 **Local Leaderboard** — Top 10 scores saved in browser
- 📊 **Full Stats**: Score, Best Score, Lines Cleared, Level, Rank
- 🎖️ **6 Rank Tiers**: Novice → Apprentice → Adept → Master → Grandmaster → Archmage
- 🃏 **Score Card** — Beautiful downloadable card with your nickname, avatar, score, rank
- 📱 **Mobile Controls** — Swipe gestures + on-screen buttons
- ⌨️ **Keyboard Controls** — Full keyboard support on desktop
- 👤 **Custom Avatar** — Upload your own photo

## How to Play

### Desktop
| Key | Action |
|-----|--------|
| ← → | Move piece |
| ↑ | Rotate |
| ↓ | Soft drop |
| Space | Hard drop |
| C / Shift | Hold piece |
| P / Escape | Pause |

### Mobile
| Gesture | Action |
|---------|--------|
| Tap | Rotate |
| Swipe Left/Right | Move |
| Swipe Down | Soft drop |
| Swipe Up | Hard drop |
| On-screen buttons | All actions |

## Scoring

| Lines | Points |
|-------|--------|
| 1 (Single) | 100 × level |
| 2 (Double) | 300 × level |
| 3 (Triple) | 500 × level |
| 4 (Tetris!) | 800 × level |
| Soft drop | 1 per row |
| Hard drop | 2 per row |

## Difficulty Speeds

| Difficulty | Base Speed | Description |
|------------|-----------|-------------|
| Easy | 550ms | For beginners |
| Medium | 320ms | Balanced challenge |
| Hard | 180ms | For skilled players |
| Expert | 90ms | Pure chaos |

Speed increases every 10 lines cleared.

## Running Locally

Just open `index.html` in your browser — no build step required!

```bash
# Optional: serve locally
npx serve .
# or
python3 -m http.server 8080
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to Settings → Pages
3. Set source to `main` branch, root folder
4. Your game will be live at `https://yourusername.github.io/repo-name`

## File Structure

```
magic-tetris/
├── index.html          # Main HTML with all screens
├── css/
│   └── style.css       # Cosmic dark theme styles
├── js/
│   ├── tetris.js       # Game engine (TetrisGame class)
│   ├── leaderboard.js  # Score persistence (localStorage)
│   └── ui.js           # UI controller, score card, controls
├── assets/
│   └── logo.webp       # Magic Tetris logo
└── README.md
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no frameworks, no dependencies
- Canvas API for game rendering and score card generation
- Google Fonts: Fredoka One + Exo 2
- localStorage for score persistence

---

Made with ✨ magic and lots of Tetris.
