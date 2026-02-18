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
    this.phase        = PHASE.SETUP;
    this.compositions = {
      1: { FOOT: 0, ARCHER: 0, HORSE: 0, PLANNER: 0 },
      2: { FOOT: 0, ARCHER: 0, HORSE: 0, PLANNER: 0 },
    };
    this.budgetLeft = { 1: BUDGET, 2: BUDGET };
    this.locked     = { 1: false, 2: false };

    this.armies       = { 1: [], 2: [] };
    this.deployPlayer = 1;
    this.deployQueue  = [];

    this.currentPlayer = 1;
    this.turn          = 1;
    this.selectedUnit  = null;
    this.pendingAction = null;   // only ACTION.INSTRUCT ever used now

    this.effects = [];
    this.winner  = null;
    this.log     = [];
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  aliveUnits(team) { return this.armies[team].filter(u => u.alive); }
  allAlive()       { return [...this.aliveUnits(1), ...this.aliveUnits(2)]; }
  unitAt(col, row) { return this.allAlive().find(u => u.gx === col && u.gy === row) || null; }

  hasPlanners(player) {
    return this.aliveUnits(player).some(u => u.type === 'PLANNER');
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────

  addUnit(player, type) {
    if (this.locked[player]) return false;
    const cost = UNIT_DEFS[type].cost;
    if (this.budgetLeft[player] < cost) return false;
    this.compositions[player][type]++;
    this.budgetLeft[player] -= cost;
    this._emit(); return true;
  }

  removeUnit(player, type) {
    if (this.locked[player]) return false;
    if (this.compositions[player][type] === 0) return false;
    this.compositions[player][type]--;
    this.budgetLeft[player] += UNIT_DEFS[type].cost;
    this._emit(); return true;
  }

  totalUnits(player) {
    return Object.values(this.compositions[player]).reduce((s, n) => s + n, 0);
  }

  lockIn(player) {
    if (this.totalUnits(player) === 0 || this.locked[player]) return false;
    this.locked[player] = true;
    this._emit();
    if (this.locked[1] && this.locked[2]) this._startDeploy();
    return true;
  }

  // ─── DEPLOY ───────────────────────────────────────────────────────────────

  _startDeploy() {
    this.phase = PHASE.DEPLOY;
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
    if (this.phase !== PHASE.DEPLOY || !this.deployQueue.length) return false;
    const p      = this.deployPlayer;
    const inZone = p === 1 ? col < DEPLOY_COLS : col >= GRID_COLS - DEPLOY_COLS;
    if (!inZone)            { this._log('⚠ Place units inside your colored zone!'); return false; }
    if (this.unitAt(col, row)) { this._log('⚠ Tile already occupied!'); return false; }

    const type = this.deployQueue.shift();
    const u    = new Unit(type, p, col, row);
    u.rx = col; u.ry = row;
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
    this._emit(); return true;
  }

  // ─── BATTLE ───────────────────────────────────────────────────────────────

  _startBattle() {
    this.phase         = PHASE.BATTLE;
    this.currentPlayer = 1;
    this.turn          = 1;
    this._beginTurn();
  }

  _beginTurn() {
    // Only Planners have user-controlled turns (INSTRUCT); reset their acted flag
    for (const u of this.aliveUnits(this.currentPlayer)) {
      u.hasActed = false;
      u.hasMoved = false;
    }
    this.selectedUnit  = null;
    this.pendingAction = null;
    this._log(`─── Round ${this.turn}: ${COLORS['p' + this.currentPlayer].name}'s turn ───`);
    this._emit();
  }

  // ── Planner selection / instruct (only user interaction in battle) ─────────

  selectUnit(u) {
    if (!u || !u.alive)                         return;
    if (u.team !== this.currentPlayer)           return;
    if (u.type !== 'PLANNER')                    return;  // only Planners selectable
    if (u.hasActed)                              return;  // already instructed this turn
    this.selectedUnit  = u;
    this.pendingAction = null;
    this._emit();
  }

  setPendingAction(action) {
    if (!this.selectedUnit) return;
    if (action !== ACTION.INSTRUCT) return;          // only INSTRUCT allowed
    if (!this.selectedUnit.def.canInstruct) return;
    this.pendingAction = action;
    this._emit();
  }

  handleBattleClick(col, row) {
    if (this.phase !== PHASE.BATTLE) return;

    const sel     = this.selectedUnit;
    const mode    = this.pendingAction;
    const clicked = this.unitAt(col, row);

    if (!mode) {
      // Try to select a friendly Planner that hasn't instructed yet
      if (clicked && clicked.team === this.currentPlayer &&
          clicked.type === 'PLANNER' && !clicked.hasActed) {
        this.selectUnit(clicked);
      }
      return;
    }

    if (mode === ACTION.INSTRUCT) {
      if (!sel || !sel.alive) { this.pendingAction = null; return; }
      this._doInstruct(sel, col, row);
      sel.hasActed       = true;
      this.selectedUnit  = null;
      this.pendingAction = null;
      this._emit();
    }
  }

  // ─── End Turn → triggers full AI simulation for current player ────────────

  endTurn() {
    if (this.phase !== PHASE.BATTLE) return;

    this._executeAI(this.currentPlayer);

    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    if (this.currentPlayer === 1) this.turn++;
    this._beginTurn();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── AI ENGINE ─────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  _executeAI(player) {
    const friends  = this.aliveUnits(player);
    const enemies  = this.aliveUnits(3 - player);
    const allAlive = this.allAlive();

    if (!enemies.length) return;

    // 1. Planners: auto-retreat if enemies are close
    for (const u of friends.filter(u => u.type === 'PLANNER')) {
      this._aiPlannerMove(u, friends, enemies);
    }

    // 2. Foot Soldiers: formation-aware attack/move
    for (const u of friends.filter(u => u.type === 'FOOT')) {
      this._aiFoot(u, friends, enemies, allAlive);
    }

    // 3. Archers: ranged harassment, retreat if too close
    for (const u of friends.filter(u => u.type === 'ARCHER')) {
      this._aiArcher(u, friends, enemies, allAlive);
    }

    // 4. Cavalry: close the gap and charge
    for (const u of friends.filter(u => u.type === 'HORSE')) {
      this._aiHorse(u, friends, enemies, allAlive);
    }

    this._checkWin();
    this._emit();
  }

  // ── Foot Soldier AI ───────────────────────────────────────────────────────
  // If rallied: stay within defenseAuraRange of an Archer/Cavalry (protector).
  //   • Not near protector → chase nearest protector.
  //   • Near protector     → attack enemy in range, else advance toward rally.
  // If not rallied: attack if enemy in range, else march toward nearest enemy.

  _aiFoot(unit, friends, enemies, allAlive) {
    const live = enemies.filter(e => e.alive);
    if (!live.length) return;

    if (unit.hasRally()) {
      const protectors = friends.filter(f =>
        f !== unit && f.alive && (f.type === 'ARCHER' || f.type === 'HORSE')
      );

      const nearProtector = protectors.some(p =>
        dist(unit.gx, unit.gy, p.gx, p.gy) <= unit.def.defenseAuraRange
      );

      if (protectors.length > 0 && !nearProtector) {
        // Formation broken: close the gap to the nearest protector first
        this._moveToward(unit, ...this._nearestXY(unit, protectors));
        return;
      }

      // In formation (or no protectors alive): attack if possible
      const inRange = live.filter(e => unit.canAttackTarget(e));
      if (inRange.length > 0) {
        this._doAttack(unit, this._pick(inRange), false); return;
      }

      // Advance toward rally point
      const step = unit.rallyStep();
      if (step) { this._doMove(unit, step.x, step.y); return; }
    }

    // Default: attack in range, else march to nearest enemy
    const inRange = live.filter(e => unit.canAttackTarget(e));
    if (inRange.length > 0) {
      this._doAttack(unit, this._pick(inRange), false); return;
    }
    const nearest = this._nearest(unit, live);
    if (nearest) this._moveToward(unit, nearest.gx, nearest.gy);
  }

  // ── Archer AI ─────────────────────────────────────────────────────────────
  // Prefer targets outside melee-penalty range.
  // If no target in range: advance (but retreat if crowded by enemies).

  _aiArcher(unit, friends, enemies, allAlive) {
    const live = enemies.filter(e => e.alive);
    if (!live.length) return;

    const penaltyRange = unit.def.meleePenaltyRange || 3;

    // Good targets: in range AND not too close
    const goodTargets = live.filter(e => {
      const d = dist(unit.gx, unit.gy, e.gx, e.gy);
      return d <= unit.def.attackRange && d > penaltyRange;
    });
    if (goodTargets.length > 0) {
      this._doAttack(unit, this._pick(goodTargets), false); return;
    }

    // Any target in range (accept penalty)?
    const anyRange = live.filter(e => unit.canAttackTarget(e));
    if (anyRange.length > 0) {
      this._doAttack(unit, this._pick(anyRange), false); return;
    }

    // Too close → retreat
    const tooClose = live.filter(e => dist(unit.gx, unit.gy, e.gx, e.gy) <= penaltyRange);
    if (tooClose.length > 0) {
      const nearest = this._nearest(unit, tooClose);
      this._moveAway(unit, nearest.gx, nearest.gy); return;
    }

    // Advance toward nearest enemy to get them in range
    const nearest = this._nearest(unit, live);
    if (nearest) this._moveToward(unit, nearest.gx, nearest.gy);
  }

  // ── Cavalry AI ────────────────────────────────────────────────────────────
  // Move toward nearest enemy (full speed), then CHARGE if any enemy in range.

  _aiHorse(unit, friends, enemies, allAlive) {
    const live = enemies.filter(e => e.alive);
    if (!live.length) return;

    const nearest = this._nearest(unit, live);
    if (!nearest) return;

    // Close the gap (cavalry is fast)
    this._moveToward(unit, nearest.gx, nearest.gy);

    // After moving, AoE charge if enemies now reachable
    const nowInRange = live.filter(e => e.alive && unit.canAttackTarget(e));
    if (nowInRange.length > 0) {
      this._doAttack(unit, null, true);   // AoE charge with 1.5× bonus
    }
  }

  // ── Planner Auto-Move ─────────────────────────────────────────────────────
  // Planners are fragile; they retreat if an enemy gets within 6 tiles.

  _aiPlannerMove(unit, friends, enemies) {
    const live = enemies.filter(e => e.alive);
    if (!live.length) return;
    const nearest = this._nearest(unit, live);
    if (!nearest) return;
    if (dist(unit.gx, unit.gy, nearest.gx, nearest.gy) <= 6) {
      this._moveAway(unit, nearest.gx, nearest.gy);
    }
  }

  // ── AI helpers ────────────────────────────────────────────────────────────

  _moveToward(unit, tx, ty) {
    const d = dist(unit.gx, unit.gy, tx, ty);
    if (d < 0.5) return;
    if (d <= unit.def.moveSpeed) {
      this._doMove(unit, tx, ty);
    } else {
      const r  = unit.def.moveSpeed / d;
      const nx = Math.round(unit.gx + (tx - unit.gx) * r);
      const ny = Math.round(unit.gy + (ty - unit.gy) * r);
      this._doMove(unit, _clamp(nx, 0, GRID_COLS - 1), _clamp(ny, 0, GRID_ROWS - 1));
    }
  }

  _moveAway(unit, fromX, fromY) {
    const dx = unit.gx - fromX;
    const dy = unit.gy - fromY;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) return;
    const r  = unit.def.moveSpeed / d;
    const nx = Math.round(unit.gx + dx * r);
    const ny = Math.round(unit.gy + dy * r);
    this._doMove(unit, _clamp(nx, 0, GRID_COLS - 1), _clamp(ny, 0, GRID_ROWS - 1));
  }

  _nearest(unit, targets) {
    if (!targets.length) return null;
    return targets.reduce((a, b) =>
      dist(unit.gx, unit.gy, a.gx, a.gy) < dist(unit.gx, unit.gy, b.gx, b.gy) ? a : b
    );
  }

  _nearestXY(unit, targets) {
    const t = this._nearest(unit, targets);
    return t ? [t.gx, t.gy] : [unit.gx, unit.gy];
  }

  _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── ACTION EXECUTORS (shared by user INSTRUCT and AI) ────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  _doMove(unit, tx, ty) {
    unit.gx = tx;
    unit.gy = ty;
    // rx/ry smoothly lerps toward gx/gy in renderer each frame
  }

  _doAttack(attacker, explicitTarget, isCharge) {
    const allAlive = this.allAlive();
    const enemies  = this.aliveUnits(3 - attacker.team);
    const atkRange = attacker.def.attackRange;

    if (attacker.def.aoeAttack) {
      const targets = enemies.filter(e =>
        e.alive && dist(attacker.gx, attacker.gy, e.gx, e.gy) <= atkRange
      );
      if (!targets.length) return;

      this.effects.push(new Effect({
        type:     attacker.type === 'HORSE' ? 'charge' : 'aoe',
        x1: attacker.gx, y1: attacker.gy,
        color:    attacker.team === 1 ? COLORS.p1.fill : COLORS.p2.fill,
        radius:   atkRange,
        duration: ANIM.PROJECTILE,
        onHit: () => {
          for (const tgt of targets) {
            const dmg  = attacker.calcDamage(tgt, allAlive, isCharge);
            const died = tgt.takeDamage(dmg);
            this._log(`${attacker.def.abbr}→${tgt.def.abbr}: ${dmg} dmg${died ? ' 💀' : ''}`);
            if (died) this._spawnDeath(tgt);
          }
          this._checkWin(); this._emit();
        },
      }));

    } else {
      const target = explicitTarget
        || enemies
            .filter(e => e.alive && dist(attacker.gx, attacker.gy, e.gx, e.gy) <= atkRange)
            .sort((a, b) =>
              dist(attacker.gx, attacker.gy, a.gx, a.gy) -
              dist(attacker.gx, attacker.gy, b.gx, b.gy)
            )[0];
      if (!target) return;

      const isRanged = atkRange > 4;
      this.effects.push(new Effect({
        type:     isRanged ? 'arrow' : 'slash',
        x1: attacker.gx, y1: attacker.gy,
        x2: target.gx,   y2: target.gy,
        duration: ANIM.PROJECTILE,
        onHit: () => {
          const dmg  = attacker.calcDamage(target, allAlive, isCharge);
          const died = target.takeDamage(dmg);
          this._log(`${attacker.def.abbr}→${target.def.abbr}: ${dmg} dmg${died ? ' 💀' : ''}`);
          if (died) this._spawnDeath(target);
          this._checkWin(); this._emit();
        },
      }));
    }
  }

  _doInstruct(planner, tx, ty) {
    const r     = planner.def.instructRange;
    const allies = this.aliveUnits(planner.team).filter(u => u !== planner);
    let count = 0;
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
    this._log(`📋 Planner rallied ${count} allies → (${tx},${ty})`);
  }

  _spawnDeath(unit) {
    const pal = unit.team === 1 ? COLORS.p1 : COLORS.p2;
    this.effects.push(new Effect({
      type: 'death', x1: unit.gx, y1: unit.gy,
      color: pal.light, duration: ANIM.DEATH,
    }));
  }

  // ─── Win check ────────────────────────────────────────────────────────────

  _checkWin() {
    const a1 = this.aliveUnits(1).length;
    const a2 = this.aliveUnits(2).length;
    if (a1 === 0 && a2 === 0) this._end(0);
    else if (a2 === 0)         this._end(1);
    else if (a1 === 0)         this._end(2);
  }

  _end(winner) {
    this.winner = winner;
    this.phase  = PHASE.GAME_OVER;
    this._emit();
  }

  // ─── Event emitter ────────────────────────────────────────────────────────
  on(fn)  { this._listeners.push(fn); }
  _emit() { this._listeners.forEach(fn => fn(this)); }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 40) this.log.pop(); }
}

// ─── module-level helper ──────────────────────────────────────────────────────
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
