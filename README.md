# ⚔️ War Simulator

A turn-based, 2-player war game that runs entirely in the browser — no installs, no server.

🎮 **[Play it live →](https://codonsp.github.io/aoe-style-war-simulator/)**

---

## How to Play

### 1. Setup — Build Your Army (500 gold each)

| Unit | Cost | HP | Speed | Damage | Range | Special |
|------|------|----|-------|--------|-------|---------|
| ⬛ Foot Soldier | 50g | 100 | 5 | 10 | 2 (AoE) | +10 defence aura to allies within 2 tiles |
| 🔺 Archer | 75g | 100 | 4 | 5 | 20 | −50% damage if target ≤ 3 tiles away |
| 🏇 Cavalry | 100g | 100 | 20 | 10 | 4 (AoE) | **Charge**: move + attack in one turn (1.5× dmg) |
| 💠 Planner | 125g | 100 | 1 | 1 | 2 | **Instruct**: rally all allies within 10 tiles to any point |

Use + / − to add or remove units. Click **Lock In Army** when ready. Both players lock in before deployment begins.

---

### 2. Deploy — Place Your Units

- **Player 1** clicks the **blue zone** (left side) to place each unit one at a time
- **Player 2** clicks the **red zone** (right side) to do the same
- Units are placed in the order: Foot → Archer → Cavalry → Planner

---

### 3. Battle — Take Turns

Players alternate turns. On your turn:

1. **Click one of your units** to select it (full-opacity = ready, faded = already acted)
2. **Choose an action** from the sidebar:

| Action | Who | What |
|--------|-----|------|
| 🚶 Move | All | Click a blue-highlighted tile to move there |
| ⚔️ Attack | All | Click a red-highlighted enemy to attack |
| ⚡ Charge | Cavalry only | Click a tile to move, then click an enemy to strike (1.5× damage) |
| 📋 Instruct | Planner only | Click any tile — all allies within 10 tiles will auto-march there each turn |

3. Repeat for your remaining units, then click **End Turn**
4. Units with a **rally command** (green dot) auto-move toward the rally point if you don't override them

**Last army standing wins.**

---

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `M` | Move mode |
| `A` | Attack mode |
| `C` | Charge mode |
| `I` | Instruct mode |
| `Space` / `Enter` | End Turn |
| `Esc` | Deselect unit |

---

## Strategy Tips

- **Foot Soldiers** cluster together to stack the +10 defence aura — a blob of 3 foot soldiers is very tanky
- **Archers** want to stay at range; keep them behind your front line and they'll chip enemies turn after turn
- **Cavalry** can cross the entire map in 2 turns — use them to snipe the enemy Planner early
- **Planners** are fragile but decisive: one Instruct command can snap a scattered army into a tight flank attack
- **Budget ideas:** 10 Foot (pure zerg) · 6 Archers (glass cannon) · 5 Cavalry (speed rush) · 2 Cavalry + 3 Archers + 1 Planner (balanced)

---

## Running Locally

Just open `index.html` via any local web server (required for ES modules):

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then visit `http://localhost:8080`.

---

## Project Structure

```
├── index.html          Main page & screen layouts
├── css/style.css       Dark-themed UI styles
└── js/
    ├── constants.js    Unit stats, grid config, colours
    ├── unit.js         Unit class (combat, rally logic)
    ├── renderer.js     Canvas drawing & visual effects
    ├── game.js         Game state machine & turn logic
    └── main.js         Event wiring & render loop
```

No frameworks, no build step — pure vanilla JS (ES modules).
