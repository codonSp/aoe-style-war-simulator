# ⚔️ War Simulator

A turn-based 2-player war simulation that runs entirely in the browser — no installs, no server.

🎮 **[Play it live →](https://codonsp.github.io/aoe-style-war-simulator/)**

---

## Overview

Armies fight **automatically**. Your only job is to place a **Planner** and issue rally orders — everything else (movement, attacking, retreating) is handled by unit AI. Last army standing wins.

---

## How to Play

### 1. Pick a Budget

Choose how large a battle you want before selecting units:

| Preset | Gold | Flavour |
|--------|------|---------|
| Skirmish | 300g | Quick, small fights |
| Standard | 500g | Balanced default |
| Large | 750g | Room for mixed armies |
| Epic | 1000g | Full-scale battles |
| Grand War | 1500g | Maximum chaos |

> Changing budget resets both players' army selections.

---

### 2. Build Your Army

| Unit | Cost | HP | Speed | Damage | Range | Special |
|------|------|----|-------|--------|-------|---------|
| ⬛ Foot Soldier | 50g | 100 | 5 | 10 | 2 (AoE) | Compounding defence aura (see below) |
| 🔺 Archer | 75g | 100 | 4 | 5 | 20 | −50 % damage vs targets within 3 tiles |
| 🏇 Cavalry | 100g | 100 | 20 | 10 | 4 (AoE) | Charge: move + AoE attack every turn (×1.5 dmg) |
| 💠 Planner | 125g | 100 | 1 | 1 | 2 | Rally: direct allies within 10 tiles to any point |

Use **+** / **−** to add or remove units. Click **Lock In Army** when ready. Both players lock in before deployment starts.

---

### 3. Deploy

- **Player 1** clicks the **blue zone** (left side) to place units one by one
- **Player 2** clicks the **red zone** (right side)
- Order placed: Foot → Archer → Cavalry → Planner

---

### 4. Battle

Players alternate turns. On your turn:

1. **Optionally click a 💠 Planner** to select it
2. Click **Rally Troops**, then click any map tile — all allies within 10 tiles will march there automatically each turn
3. A Planner can issue one rally order per turn; you can command each of your Planners separately
4. Click **End Turn** — your entire army acts automatically

> **Keyboard:** `I` = Instruct · `Space / Enter` = End Turn · `Esc` = Deselect

---

### 5. Win

Last team with alive units wins. The simulation keeps going until one side is wiped out.

---

## Unit AI Behaviour

All units act on their own when you click End Turn:

### Foot Soldier
- **If rallied and near a protector** (Archer or Cavalry within 2 tiles): attack any enemy in range, then advance toward the rally point
- **If rallied but not near a protector**: chase the nearest allied Archer or Cavalry first to restore the protective formation
- **If not rallied**: march toward and attack the nearest enemy

### Archer
- Attacks random target in range, preferring targets **outside** melee-penalty range (> 3 tiles)
- Retreats if an enemy closes within 3 tiles
- Advances toward the nearest enemy when no one is in range

### Cavalry
- Moves at full speed (20 tiles/turn) toward the nearest enemy
- Automatically charges (AoE, ×1.5 damage) any enemy in range after moving
- Effectively combines movement and attack every turn

### Planner
- Auto-retreats if any enemy gets within 6 tiles (moveSpeed = 1 so it barely escapes, protect it!)
- No useful combat ability — its value is entirely in the rally command

---

## Foot Soldier Defence: Compounding Multiplier

The Foot Soldier's defensive aura is **multiplicative and compounding**. Each allied Foot Soldier within **2 tiles** of a target unit multiplies incoming damage by **×0.8** (20 % reduction):

| Nearby Foot Soldiers | Damage taken |
|---|---|
| 0 | 100 % |
| 1 | 80 % `(0.8¹)` |
| 2 | 64 % `(0.8²)` |
| 3 | 51 % `(0.8³)` |
| 4 | 41 % `(0.8⁴)` |

This applies to **any** unit the foot soldiers are clustered around — Archers, Cavalry, and other Foot Soldiers alike. Packing foot soldiers tightly around your Archer line makes them dramatically harder to kill.

To tune the multiplier, change `FOOT_DEFENSE_MULT` in [js/constants.js](js/constants.js).

---

## Strategy Tips

- **Mass Foot Soldiers** — 6 Foot soldiers clustered together each take only 26 % damage (0.8⁶). A nearly invincible wall if you can keep them together.
- **Foot + Archer combo** — Foot soldiers sit in front; Archers fire from the back protected by the Foot aura. Use a Planner to keep both groups moving together.
- **Cavalry rush** — At speed 20, Cavalry can cross the whole map in 2 turns. Rush the enemy Planner before they can issue orders.
- **Protect the Planner** — Planners auto-retreat but moveSpeed = 1. Surround them with Foot Soldiers or they'll be killed by Cavalry.
- **Budget ideas (500g standard):**
  - `10 × Foot` — pure zerg wall (500g)
  - `6 × Archer + 1 × Foot` — fragile but long-range (450+50g)
  - `5 × Cavalry` — speed rush (500g)
  - `2 × Cavalry + 3 × Archer + 1 × Planner` — controlled strike force (200+225+125 = 550g, use 750g budget)

---

## Running Locally

ES modules require a server (not `file://`):

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080`.

---

## Project Structure

```
├── index.html           Main page & screen layouts
├── css/style.css        Dark-themed UI styles
└── js/
    ├── constants.js     Unit stats, grid config, defence constants, colours
    ├── unit.js          Unit class (compounding defence, rally logic)
    ├── renderer.js      Canvas drawing, projectile & death effects
    ├── game.js          State machine, AI engine, Planner-only interaction
    └── main.js          Event wiring, budget selector, render loop
```

No frameworks · No build step · Pure vanilla JS (ES modules)
