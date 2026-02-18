import { TILE, GRID_COLS, GRID_ROWS, COLORS, DEPLOY_COLS, PHASE, ACTION, ANIM } from './constants.js';
import { dist } from './unit.js';

// ─── Projectile / effect object ──────────────────────────────────────────────
export class Effect {
  constructor({ type, x1, y1, x2, y2, color, radius, duration, onHit, team }) {
    this.type     = type;     // 'arrow' | 'slash' | 'aoe' | 'rally' | 'death'
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2 ?? x1; this.y2 = y2 ?? y1;
    this.color    = color || '#fff';
    this.radius   = radius || 0;
    this.duration = duration || 400;
    this.elapsed  = 0;
    this.done     = false;
    this.onHit    = onHit || null;    // callback when projectile lands
    this.hitFired = false;
    this.team     = team;
  }

  get t() { return Math.min(1, this.elapsed / this.duration); }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.done = true;
      if (this.onHit && !this.hitFired) { this.hitFired = true; this.onHit(); }
    }
    // For projectiles, fire onHit when they arrive (~t=0.95)
    if (!this.hitFired && this.t >= 0.95 && this.onHit) {
      this.hitFired = true;
      this.onHit();
    }
  }
}

// ─── Renderer ────────────────────────────────────────────────────────────────
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    canvas.width  = GRID_COLS * TILE;
    canvas.height = GRID_ROWS * TILE;
  }

  // ─── master draw ──────────────────────────────────────────────────────────
  draw(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawBackground(game);
    this._drawZones(game);
    this._drawHighlights(game);
    this._drawEffects(game);
    this._drawUnits(game);
    this._drawRallyLines(game);
    this._drawOverlay(game);
  }

  // ─── background / grid ────────────────────────────────────────────────────
  _drawBackground(game) {
    const ctx = this.ctx;
    // Dark battlefield
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, 0);
      ctx.lineTo(c * TILE, GRID_ROWS * TILE);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE);
      ctx.lineTo(GRID_COLS * TILE, r * TILE);
      ctx.stroke();
    }
  }

  _drawZones(game) {
    const ctx = this.ctx;
    if (game.phase === PHASE.DEPLOY || game.phase === PHASE.BATTLE) {
      // P1 zone (left)
      ctx.fillStyle = COLORS.zone1;
      ctx.fillRect(0, 0, DEPLOY_COLS * TILE, GRID_ROWS * TILE);
      // P2 zone (right)
      ctx.fillStyle = COLORS.zone2;
      ctx.fillRect((GRID_COLS - DEPLOY_COLS) * TILE, 0, DEPLOY_COLS * TILE, GRID_ROWS * TILE);
    }
  }

  // ─── highlights ───────────────────────────────────────────────────────────
  _drawHighlights(game) {
    const ctx = this.ctx;
    const sel  = game.selectedUnit;
    if (!sel || game.phase !== PHASE.BATTLE) return;

    const mode = game.pendingAction;

    // CHARGE phase 1 (not yet moved) → show move tiles; CHARGE phase 2 (moved) → skip move tiles
    const showMoveHL   = mode === ACTION.MOVE || (mode === ACTION.CHARGE && !sel.hasMoved);
    const showAttackHL = mode === ACTION.ATTACK || (mode === ACTION.CHARGE && sel.hasMoved);

    if (showMoveHL) {
      // Highlight reachable tiles
      for (let c = 0; c < GRID_COLS; c++) {
        for (let r = 0; r < GRID_ROWS; r++) {
          if (dist(sel.gx, sel.gy, c, r) <= sel.def.moveSpeed) {
            ctx.fillStyle = COLORS.moveHL;
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }
    }

    if (showAttackHL) {
      // Highlight enemy units in attack range
      const enemies = game.aliveUnits(3 - sel.team);
      for (const e of enemies) {
        if (sel.canAttackTarget(e)) {
          ctx.fillStyle = COLORS.attackHL;
          ctx.fillRect(e.rx * TILE, e.ry * TILE, TILE, TILE);
          // Red ring
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 2;
          ctx.strokeRect(e.rx * TILE + 1, e.ry * TILE + 1, TILE - 2, TILE - 2);
        }
      }
    }

    if (mode === ACTION.INSTRUCT) {
      // Show instruct radius around planner
      const r = sel.def.instructRange;
      ctx.strokeStyle = COLORS.rally;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc((sel.rx + 0.5) * TILE, (sel.ry + 0.5) * TILE, r * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight allies in range (show they'll receive the command)
      const allies = game.aliveUnits(sel.team).filter(u => u !== sel);
      for (const a of allies) {
        if (dist(sel.gx, sel.gy, a.gx, a.gy) <= r) {
          ctx.fillStyle = COLORS.instructHL;
          ctx.fillRect(a.rx * TILE, a.ry * TILE, TILE, TILE);
        }
      }
      // Show a cursor ring everywhere (drawn via cursor)
    }

    // Highlight attack-range ring when unit selected with no action
    if (!mode) {
      const atkR = sel.def.attackRange;
      ctx.strokeStyle = 'rgba(231,76,60,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc((sel.rx + 0.5) * TILE, (sel.ry + 0.5) * TILE, atkR * TILE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ─── effects ──────────────────────────────────────────────────────────────
  _drawEffects(game) {
    const ctx = this.ctx;
    for (const fx of game.effects) {
      const t  = fx.t;
      const cx = (fx.x1 + (fx.x2 - fx.x1) * t + 0.5) * TILE;
      const cy = (fx.y1 + (fx.y2 - fx.y1) * t + 0.5) * TILE;

      ctx.save();

      switch (fx.type) {
        case 'arrow': {
          // Draw arrow line from x1 to current position
          const sx = (fx.x1 + 0.5) * TILE;
          const sy = (fx.y1 + 0.5) * TILE;
          ctx.strokeStyle = '#f39c12';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          // Arrowhead
          const angle = Math.atan2(cy - sy, cx - sx);
          ctx.fillStyle = '#f39c12';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - 8 * Math.cos(angle - 0.4), cy - 8 * Math.sin(angle - 0.4));
          ctx.lineTo(cx - 8 * Math.cos(angle + 0.4), cy - 8 * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fill();
          break;
        }

        case 'slash': {
          // Quick arc sweep for melee
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, TILE * 0.8, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
          // Impact sparks
          if (t > 0.5) {
            ctx.fillStyle = '#f1c40f';
            for (let i = 0; i < 4; i++) {
              const ang = (i / 4) * Math.PI * 2;
              const r   = (t - 0.5) * TILE * 1.5;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }

        case 'aoe': {
          // Expanding ring (for foot-soldier / cavalry area attack)
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          const radius = fx.radius * TILE * t;
          ctx.arc((fx.x1 + 0.5) * TILE, (fx.y1 + 0.5) * TILE, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'charge': {
          // Dust trail behind cavalry
          const alpha = 1 - t;
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillStyle = '#d4ac0d';
          ctx.beginPath();
          ctx.arc(cx, cy, TILE * 0.5 * (1 - t * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'rally': {
          // Expanding ripple from planner
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = COLORS.rally;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          const rr = fx.radius * TILE * t;
          ctx.beginPath();
          ctx.arc((fx.x1 + 0.5) * TILE, (fx.y1 + 0.5) * TILE, rr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }

        case 'death': {
          // Fading explosion
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fx.color;
          ctx.beginPath();
          ctx.arc((fx.x1 + 0.5) * TILE, (fx.y1 + 0.5) * TILE, TILE * 0.6 * (1 + t * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  // ─── units ────────────────────────────────────────────────────────────────
  _drawUnits(game) {
    const allUnits = [...game.armies[1], ...game.armies[2]];
    for (const u of allUnits) {
      if (!u.alive && u.opacity <= 0) continue;
      this._drawUnit(u, game);
    }
  }

  _drawUnit(u, game) {
    const ctx  = this.ctx;
    const px   = (u.rx + 0.5) * TILE;
    const py   = (u.ry + 0.5) * TILE;
    const pal  = u.team === 1 ? COLORS.p1 : COLORS.p2;
    const sz   = TILE * 0.72;

    ctx.save();
    ctx.globalAlpha = u.alive ? (u.hasActed && game.currentPlayer === u.team ? COLORS.acted : u.opacity) : u.opacity;

    // ── selection ring ──
    if (u === game.selectedUnit) {
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.select;
      ctx.shadowBlur  = 8;
      ctx.strokeRect(u.rx * TILE + 1, u.ry * TILE + 1, TILE - 2, TILE - 2);
      ctx.shadowBlur = 0;
    }

    // ── rally indicator dot ──
    if (u.hasRally()) {
      ctx.fillStyle = COLORS.rally;
      ctx.beginPath();
      ctx.arc(u.rx * TILE + TILE - 4, u.ry * TILE + 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── damage flash ──
    const flashOn = u.flashTimer > 0;
    const fillColor = flashOn ? '#e74c3c' : pal.fill;

    ctx.fillStyle   = fillColor;
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth   = 1.5;

    switch (u.type) {
      case 'FOOT': {
        const h = sz;
        ctx.fillRect(px - h / 2, py - h / 2, h, h);
        ctx.strokeRect(px - h / 2, py - h / 2, h, h);
        // Cross symbol
        ctx.strokeStyle = flashOn ? '#fff' : pal.light;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py - sz * 0.3); ctx.lineTo(px, py + sz * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - sz * 0.3, py); ctx.lineTo(px + sz * 0.3, py); ctx.stroke();
        break;
      }
      case 'ARCHER': {
        // Triangle pointing up
        ctx.beginPath();
        ctx.moveTo(px, py - sz / 2);
        ctx.lineTo(px + sz / 2, py + sz / 2);
        ctx.lineTo(px - sz / 2, py + sz / 2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Small bow arc inside
        ctx.strokeStyle = flashOn ? '#fff' : pal.light;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py + sz * 0.1, sz * 0.18, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        break;
      }
      case 'HORSE': {
        // Elongated ellipse (horizontal)
        ctx.beginPath();
        ctx.ellipse(px, py, sz * 0.55, sz * 0.32, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Mane line
        ctx.strokeStyle = flashOn ? '#fff' : pal.light;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - sz * 0.3, py - sz * 0.1);
        ctx.quadraticCurveTo(px, py - sz * 0.28, px + sz * 0.3, py - sz * 0.1);
        ctx.stroke();
        break;
      }
      case 'PLANNER': {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(px,          py - sz / 2);
        ctx.lineTo(px + sz / 2, py);
        ctx.lineTo(px,          py + sz / 2);
        ctx.lineTo(px - sz / 2, py);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Star center dot
        ctx.fillStyle = flashOn ? '#fff' : pal.light;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // ── abbreviation label ──
    ctx.fillStyle   = '#fff';
    ctx.font        = `bold ${Math.floor(TILE * 0.38)}px monospace`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(u.def.abbr, px, py + sz * 0.52 + 2);

    // ── health bar ──
    const barW  = TILE - 4;
    const barH  = 3;
    const barX  = u.rx * TILE + 2;
    const barY  = u.ry * TILE;
    const pct   = u.hp / u.def.maxHp;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.55 ? '#2ecc71' : pct > 0.28 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * pct, barH);

    ctx.restore();
  }

  // ─── rally lines ──────────────────────────────────────────────────────────
  _drawRallyLines(game) {
    const ctx = this.ctx;
    const allUnits = [...game.armies[1], ...game.armies[2]];
    for (const u of allUnits) {
      if (!u.alive || !u.hasRally()) continue;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = COLORS.rally;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo((u.rx + 0.5) * TILE, (u.ry + 0.5) * TILE);
      ctx.lineTo((u.rallyX + 0.5) * TILE, (u.rallyY + 0.5) * TILE);
      ctx.stroke();
      ctx.setLineDash([]);
      // Target marker
      ctx.fillStyle = COLORS.rally;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc((u.rallyX + 0.5) * TILE, (u.rallyY + 0.5) * TILE, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ─── overlay text ─────────────────────────────────────────────────────────
  _drawOverlay(game) {
    const ctx = this.ctx;
    if (game.phase === PHASE.DEPLOY) {
      const who = game.deployPlayer;
      const pal = who === 1 ? COLORS.p1 : COLORS.p2;
      ctx.save();
      ctx.fillStyle = pal.fill + 'cc';
      ctx.fillRect(0, 0, GRID_COLS * TILE, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const zone = who === 1 ? 'left zone (blue)' : 'right zone (red)';
      ctx.fillText(`${pal.name}: click the ${zone} to place your units`, GRID_COLS * TILE / 2, 11);
      ctx.restore();
    }
  }

  // ─── animation tick ───────────────────────────────────────────────────────
  updateAnimations(game, dt) {
    // Smooth unit render positions
    const lerp = 0.18; // per-frame approach factor (frame-rate dependent, works for ~60fps)
    const allUnits = [...game.armies[1], ...game.armies[2]];
    for (const u of allUnits) {
      u.rx += (u.gx - u.rx) * (1 - Math.pow(1 - lerp, dt / 16));
      u.ry += (u.gy - u.ry) * (1 - Math.pow(1 - lerp, dt / 16));
      if (u.flashTimer > 0) u.flashTimer -= dt;
      if (!u.alive) {
        u.opacity = Math.max(0, u.opacity - dt / ANIM.DEATH);
      }
    }

    // Tick effects
    game.effects = game.effects.filter(fx => { fx.update(dt); return !fx.done; });
  }

  // ─── pixel → tile ─────────────────────────────────────────────────────────
  pixelToTile(px, py) {
    return {
      col: Math.floor(px / TILE),
      row: Math.floor(py / TILE),
    };
  }
}
