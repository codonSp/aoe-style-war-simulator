import {
  GRID_COLS, GRID_ROWS, DEPLOY_COLS, BUDGET,
  PHASE, ACTION, UNIT_DEFS, COLORS, ANIM,
} from './constants.js';
import { Unit, dist } from './unit.js';
import { Effect } from './renderer.js';

// ─── Game ────────────────────────────────────────────────────────────────────
export class Game {
  constructor() {
    this._listeners = [];
    this.reset();
  }

  reset() {
    // ── setup ──
    this.phase        = PHASE.SETUP;
    this.compositions = {
      1: { FOOT: 0, ARCHER: 0, HORSE: 0, PLANNER: 0 },
      2: { FOOT: 0, ARCHER: 0, HORSE: 0, PLANNER: 0 },
    };
    this.budgetLeft = { 1: BUDGET, 2: BUDGET };
    this.locked     = { 1: false, 2: false };

    // ── deploy ──
    this.armies       = { 1: [], 2: [] };
    this.deployPlayer = 1;
    this.deployQueue  = [];   // remaining types to place for current deploy player

    // ── battle ──
    this.currentPlayer = 1;
    this.turn          = 1;
    this.selectedUnit  = null;
    this.pendingAction = null;  // ACTION.*

    // ── visuals ──
    this.effects = [];

    // ── outcome ──
    this.winner = null;
    this.log    = [];
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  aliveUnits(team) {
    return this.armies[team].filter(u => u.alive);
  }

  allAlive() {
    return [...this.aliveUnits(1), ...this.aliveUnits(2)];
  }

  unitAt(col, row) {
    return this.allAlive().find(u => u.gx === col && u.gy === row) || null;
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────

  addUnit(player, type) {
    if (this.locked[player]) return false;
    const cost = UNIT_DEFS[type].cost;
    if (this.budgetLeft[player] < cost) return false;
    this.compositions[player][type]++;
    this.budgetLeft[player] -= cost;
    this._emit();
    return true;
  }

  removeUnit(player, type) {
    if (this.locked[player]) return false;
    if (this.compositions[player][type] === 0) return false;
    this.compositions[player][type]--;
    this.budgetLeft[player] += UNIT_DEFS[type].cost;
    this._emit();
    return true;
  }

  totalUnits(player) {
    return Object.values(this.compositions[player]).reduce((s, n) => s + n, 0);
  }

  lockIn(player) {
    if (this.totalUnits(player) === 0) return false;
    if (this.locked[player]) return false;
    this.locked[player] = true;
    this._emit();
    if (this.locked[1] && this.locked[2]) this._startDeploy();
    return true;
  }

  // ─── DEPLOY ───────────────────────────────────────────────────────────────

  _startDeploy() {
    this.phase        = PHASE.DEPLOY;
    this.deployPlayer = 1;
    this._buildDeployQueue(1);
    this._emit();
  }

  _buildDeployQueue(player) {
    this.deployQueue = [];
    const comp = this.compositions[player];
    for (const type of ['FOOT', 'ARCHER', 'HORSE', 'PLANNER']) {
      for (let i = 0; i < comp[type]; i++) this.deployQueue.push(type);
    }
  }

  placeUnit(col, row) {
    if (this.phase !== PHASE.DEPLOY) return false;
    if (this.deployQueue.length === 0) return false;

    const p = this.deployPlayer;
    const inZone = p === 1
      ? col < DEPLOY_COLS
      : col >= GRID_COLS - DEPLOY_COLS;
    if (!inZone) { this._log('⚠ Place units inside your colored zone!'); return false; }
    if (this.unitAt(col, row)) { this._log('⚠ Tile already occupied!'); return false; }

    const type = this.deployQueue.shift();
    const u    = new Unit(type, p, col, row);
    u.rx = col; u.ry = row;   // start render pos at placement
    this.armies[p].push(u);

    this._log(`${p === 1 ? '🔵' : '🔴'} placed ${UNIT_DEFS[type].name} at (${col},${row})`);

    if (this.deployQueue.length === 0) {
      if (p === 1) {
        this.deployPlayer = 2;
        this._buildDeployQueue(2);
        this._log('🔴 Player 2: place your units in the red zone →');
      } else {
        this._startBattle();
        return true;
      }
    }
    this._emit();
    return true;
  }

  // ─── BATTLE ───────────────────────────────────────────────────────────────

  _startBattle() {
    this.phase         = PHASE.BATTLE;
    this.currentPlayer = 1;
    this.turn          = 1;
    this._beginTurn();
  }

  _beginTurn() {
    for (const u of this.aliveUnits(this.currentPlayer)) {
      u.hasActed = false;
      u.hasMoved = false;
    }
    this.selectedUnit  = null;
    this.pendingAction = null;
    this._log(`─── Round ${this.turn}: ${COLORS['p' + this.currentPlayer].name}'s turn ───`);
    this._emit();
  }

  // ── selection ─────────────────────────────────────────────────────────────

  selectUnit(u) {
    if (!u || !u.alive) return;
    if (u.team !== this.currentPlayer) return;
    if (u.hasActed) return;
    this.selectedUnit  = u;
    this.pendingAction = null;
    this._emit();
  }

  setPendingAction(action) {
    if (!this.selectedUnit) return;
    const sel = this.selectedUnit;
    if (action === ACTION.INSTRUCT && !sel.def.canInstruct) return;
    if (action === ACTION.CHARGE   && !sel.def.canCharge)   return;
    this.pendingAction = action;
    this._emit();
  }

  // ── canvas click dispatcher ───────────────────────────────────────────────

  handleBattleClick(col, row) {
    if (this.phase !== PHASE.BATTLE) return;

    const sel  = this.selectedUnit;
    const mode = this.pendingAction;
    const clicked = this.unitAt(col, row);

    // ── no action pending → select a unit ──
    if (!mode) {
      if (clicked && clicked.team === this.currentPlayer && !clicked.hasActed) {
        this.selectUnit(clicked);
      }
      return;
    }

    // ── MOVE ──
    if (mode === ACTION.MOVE) {
      if (!sel.canReach(col, row)) { this._log('⚠ Too far away'); return; }
      this._doMove(sel, col, row);
      this._finishAction(sel);
      return;
    }

    // ── ATTACK ──
    if (mode === ACTION.ATTACK) {
      if (sel.def.aoeAttack) {
        // AoE: just confirm by clicking anywhere, hits all in range
        // (for clarity require clicking an enemy)
        if (!clicked || clicked.team === this.currentPlayer) {
          this._log('⚠ Click an enemy to confirm AoE attack'); return;
        }
        if (!sel.canAttackTarget(clicked)) { this._log('⚠ Enemy out of range'); return; }
        this._doAttack(sel, null, false);
      } else {
        // Single-target: must click a specific enemy
        if (!clicked || clicked.team === this.currentPlayer) {
          this._log('⚠ Click an enemy to attack'); return;
        }
        if (!sel.canAttackTarget(clicked)) { this._log('⚠ Enemy out of range'); return; }
        this._doAttack(sel, clicked, false);
      }
      this._finishAction(sel);
      return;
    }

    // ── CHARGE (cavalry: move then attack) ──
    if (mode === ACTION.CHARGE) {
      if (!sel.hasMoved) {
        // Phase 1 – pick a tile to move to
        if (!sel.canReach(col, row)) { this._log('⚠ Too far to charge'); return; }
        this._doMove(sel, col, row);
        sel.hasMoved = true;
        this._log('⚡ Cavalry moved — now click an enemy to strike!');
        this._emit();
      } else {
        // Phase 2 – pick the enemy to attack
        if (!clicked || clicked.team === this.currentPlayer) {
          this._log('⚠ Click an enemy to strike'); return;
        }
        if (!sel.canAttackTarget(clicked)) { this._log('⚠ Enemy out of charge range'); return; }
        this._doAttack(sel, clicked, true);
        this._finishAction(sel);
      }
      return;
    }

    // ── INSTRUCT (planner rally) ──
    if (mode === ACTION.INSTRUCT) {
      this._doInstruct(sel, col, row);
      this._finishAction(sel);
      return;
    }
  }

  _finishAction(unit) {
    unit.hasActed  = true;
    this.selectedUnit  = null;
    this.pendingAction = null;
    this._checkWin();
    this._emit();
  }

  // ─── action executors ─────────────────────────────────────────────────────

  _doMove(unit, tx, ty) {
    unit.gx = tx;
    unit.gy = ty;
    // render pos (rx/ry) animates toward (gx/gy) each frame in renderer
  }

  _doAttack(attacker, explicitTarget, isCharge) {
    const allUnits = this.allAlive();
    const enemies  = this.aliveUnits(3 - attacker.team);
    const atkRange = attacker.def.attackRange;

    if (attacker.def.aoeAttack) {
      // ── AoE hit ──
      const targets = enemies.filter(e =>
        dist(attacker.gx, attacker.gy, e.gx, e.gy) <= atkRange
      );

      const atkColor = attacker.team === 1 ? COLORS.p1.fill : COLORS.p2.fill;
      this.effects.push(new Effect({
        type:     attacker.type === 'HORSE' ? 'charge' : 'aoe',
        x1: attacker.gx, y1: attacker.gy,
        color:    atkColor,
        radius:   atkRange,
        duration: ANIM.PROJECTILE,
        onHit: () => {
          for (const tgt of targets) {
            const dmg  = attacker.calcDamage(tgt, allUnits, isCharge);
            const died = tgt.takeDamage(dmg);
            this._log(`${attacker.def.abbr}→${tgt.def.abbr}: ${dmg} dmg${died ? ' 💀' : ''}`);
            if (died) this._spawnDeath(tgt);
          }
          this._checkWin();
          this._emit();
        },
      }));

    } else {
      // ── Single-target hit ──
      const target = explicitTarget
        || enemies
            .filter(e => dist(attacker.gx, attacker.gy, e.gx, e.gy) <= atkRange)
            .sort((a, b) =>
              dist(attacker.gx, attacker.gy, a.gx, a.gy) -
              dist(attacker.gx, attacker.gy, b.gx, b.gy)
            )[0];

      if (!target) { this._log('No valid targets in range'); return; }

      // Projectile (arrow for archer, slash for planner/melee)
      const isRanged = atkRange > 4;
      this.effects.push(new Effect({
        type:     isRanged ? 'arrow' : 'slash',
        x1: attacker.gx, y1: attacker.gy,
        x2: target.gx,   y2: target.gy,
        duration: ANIM.PROJECTILE,
        onHit: () => {
          const dmg  = attacker.calcDamage(target, allUnits, isCharge);
          const died = target.takeDamage(dmg);
          this._log(`${attacker.def.abbr}→${target.def.abbr}: ${dmg} dmg${died ? ' 💀' : ''}`);
          if (died) this._spawnDeath(target);
          this._checkWin();
          this._emit();
        },
      }));
    }
  }

  _doInstruct(planner, tx, ty) {
    const r      = planner.def.instructRange;
    const allies = this.aliveUnits(planner.team).filter(u => u !== planner);
    let   count  = 0;
    for (const u of allies) {
      if (dist(planner.gx, planner.gy, u.gx, u.gy) <= r) {
        u.setRally(tx, ty);
        count++;
      }
    }
    this.effects.push(new Effect({
      type: 'rally',
      x1: planner.gx, y1: planner.gy,
      radius:   r,
      duration: ANIM.RALLY,
    }));
    this._log(`📋 Planner rallied ${count} allies to (${tx},${ty})`);
  }

  _spawnDeath(unit) {
    const pal = unit.team === 1 ? COLORS.p1 : COLORS.p2;
    this.effects.push(new Effect({
      type: 'death',
      x1: unit.gx, y1: unit.gy,
      color: pal.light,
      duration: ANIM.DEATH,
    }));
  }

  // ─── End Turn ─────────────────────────────────────────────────────────────

  endTurn() {
    if (this.phase !== PHASE.BATTLE) return;

    // Auto-advance rallied units that haven't acted
    for (const u of this.aliveUnits(this.currentPlayer)) {
      if (!u.hasActed && u.hasRally()) {
        const step = u.rallyStep();
        if (step) {
          this._doMove(u, step.x, step.y);
          this._log(`${u.def.abbr} auto-moves toward rally`);
        }
        u.hasActed = true;
      }
    }

    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    if (this.currentPlayer === 1) this.turn++;
    this._beginTurn();
  }

  // ─── win detection ────────────────────────────────────────────────────────

  _checkWin() {
    const a1 = this.aliveUnits(1).length;
    const a2 = this.aliveUnits(2).length;
    if (a1 === 0 && a2 === 0) { this._end(0); }
    else if (a2 === 0)         { this._end(1); }
    else if (a1 === 0)         { this._end(2); }
  }

  _end(winner) {
    this.winner = winner;
    this.phase  = PHASE.GAME_OVER;
    this._emit();
  }

  // ─── event emitter ────────────────────────────────────────────────────────

  on(fn)  { this._listeners.push(fn); }
  _emit() { this._listeners.forEach(fn => fn(this)); }
  _log(msg) {
    this.log.unshift(msg);
    if (this.log.length > 40) this.log.pop();
  }
}
