import { UNIT_DEFS } from './constants.js';

let _nextId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────
export function dist(ax, ay, bx, by) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

// ─── Unit ────────────────────────────────────────────────────────────────────
export class Unit {
  constructor(type, team, gx, gy) {
    this.id      = _nextId++;
    this.type    = type;          // 'FOOT' | 'ARCHER' | 'HORSE' | 'PLANNER'
    this.def     = UNIT_DEFS[type];
    this.team    = team;          // 1 | 2
    // Grid position (integer tile coords)
    this.gx      = gx;
    this.gy      = gy;
    // Render position (tile coords, fractional during animation)
    this.rx      = gx;
    this.ry      = gy;
    // Vitals
    this.hp      = this.def.maxHp;
    this.alive   = true;
    // Turn tracking
    this.hasActed  = false;
    this.hasMoved  = false;       // cavalry: moved this turn
    // Rally (from Planner INSTRUCT)
    this.rallyX  = null;
    this.rallyY  = null;
    // Visual state
    this.opacity     = 1;
    this.flashTimer  = 0;   // >0 → draw damage flash
    this.selected    = false;
  }

  // ─── queries ──────────────────────────────────────────────────────────────

  get name()      { return this.def.name; }
  get maxHp()     { return this.def.maxHp; }
  get moveSpeed() { return this.def.moveSpeed; }
  get damage()    { return this.def.damage; }

  canReach(tx, ty) {
    return dist(this.gx, this.gy, tx, ty) <= this.def.moveSpeed;
  }

  canAttackTarget(target) {
    return dist(this.gx, this.gy, target.gx, target.gy) <= this.def.attackRange;
  }

  canInstructTarget(target) {
    // Returns true if target ally is within instruct range
    return this.def.canInstruct &&
      dist(this.gx, this.gy, target.gx, target.gy) <= this.def.instructRange;
  }

  // ─── combat ───────────────────────────────────────────────────────────────

  /** Effective defense of THIS unit (own base + all nearby foot aura) */
  effectiveDefense(allUnits) {
    let dr = this.def.baseDefense;
    for (const u of allUnits) {
      if (u === this) continue;
      if (!u.alive || u.team !== this.team || u.type !== 'FOOT') continue;
      if (dist(u.gx, u.gy, this.gx, this.gy) <= u.def.defenseAuraRange) {
        dr += u.def.defenseAura;
      }
    }
    return dr;
  }

  /** Damage this unit would deal to `target` given current state */
  calcDamage(target, allUnits, chargeThisTurn = false) {
    let dmg = this.def.damage;

    if (this.type === 'HORSE' && chargeThisTurn) {
      dmg = Math.round(dmg * this.def.chargeMultiplier);
    }

    if (this.type === 'ARCHER') {
      const d = dist(this.gx, this.gy, target.gx, target.gy);
      if (d <= this.def.meleePenaltyRange) dmg = Math.round(dmg * 0.5);
    }

    const dr = target.effectiveDefense(allUnits);
    return Math.max(0, dmg - dr);
  }

  /** Apply damage; returns true if this unit just died */
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 200; // ms
    if (this.hp === 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  // ─── rally ────────────────────────────────────────────────────────────────

  setRally(tx, ty) {
    this.rallyX = tx;
    this.rallyY = ty;
  }

  clearRally() {
    this.rallyX = null;
    this.rallyY = null;
  }

  hasRally() {
    return this.rallyX !== null;
  }

  /** Returns the grid tile this unit should move to this turn to follow rally */
  rallyStep() {
    if (!this.hasRally()) return null;
    const d = dist(this.gx, this.gy, this.rallyX, this.rallyY);
    if (d <= 0.5) {
      this.clearRally();
      return null;
    }
    // Move moveSpeed tiles toward rally target (never overshoot)
    if (d <= this.def.moveSpeed) {
      // Can reach target this turn
      return { x: this.rallyX, y: this.rallyY };
    }
    const ratio = this.def.moveSpeed / d;
    const nx = Math.round(this.gx + (this.rallyX - this.gx) * ratio);
    const ny = Math.round(this.gy + (this.rallyY - this.gy) * ratio);
    return {
      x: Math.max(0, Math.min(39, nx)),
      y: Math.max(0, Math.min(27, ny)),
    };
  }
}
