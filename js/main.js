import { UNIT_DEFS, BUDGET, PHASE, ACTION, COLORS, GRID_COLS } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  setup:    $('screen-setup'),
  battle:   $('screen-battle'),
  gameover: $('screen-gameover'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
const game     = new Game();
const renderer = new Renderer($('gameCanvas'));
let   lastTime = 0;

// ─── Setup UI ─────────────────────────────────────────────────────────────────
function buildSetupUI() {
  for (const player of [1, 2]) {
    const container = $(`p${player}-unit-selector`);
    container.innerHTML = '';
    for (const [type, def] of Object.entries(UNIT_DEFS)) {
      const card = document.createElement('div');
      card.className = 'unit-card';
      card.innerHTML = `
        <div class="unit-card-header">
          <strong>${def.name}</strong>
          <span class="unit-cost">${def.cost}g</span>
        </div>
        <div class="unit-stats">HP:${def.maxHp} · Spd:${def.moveSpeed} · Dmg:${def.damage} · Rng:${def.attackRange}</div>
        <div class="unit-controls">
          <button class="btn-minus" data-player="${player}" data-type="${type}">−</button>
          <span class="unit-count" id="p${player}-count-${type}">0</span>
          <button class="btn-plus" data-player="${player}" data-type="${type}">+</button>
        </div>`;
      container.appendChild(card);
    }
  }

  // Event delegation for +/−
  document.querySelectorAll('.btn-plus').forEach(btn =>
    btn.addEventListener('click', () => game.addUnit(+btn.dataset.player, btn.dataset.type))
  );
  document.querySelectorAll('.btn-minus').forEach(btn =>
    btn.addEventListener('click', () => game.removeUnit(+btn.dataset.player, btn.dataset.type))
  );

  $('p1-lock').addEventListener('click', () => {
    if (game.lockIn(1)) {
      $('p1-lock').classList.add('locked');
      $('p1-lock').textContent = '✓ Locked In';
      $('p1-lock').disabled = true;
    }
  });
  $('p2-lock').addEventListener('click', () => {
    if (game.lockIn(2)) {
      $('p2-lock').classList.add('locked');
      $('p2-lock').textContent = '✓ Locked In';
      $('p2-lock').disabled = true;
    }
  });
}

function refreshSetupUI() {
  for (const player of [1, 2]) {
    $(`p${player}-budget`).textContent = game.budgetLeft[player];
    for (const type of Object.keys(UNIT_DEFS)) {
      const el = $(`p${player}-count-${type}`);
      if (el) el.textContent = game.compositions[player][type];
    }
  }
}

// ─── Battle UI ────────────────────────────────────────────────────────────────
function refreshBattleUI() {
  if (game.phase === PHASE.SETUP) return;

  // Turn banner
  const pal = COLORS['p' + game.currentPlayer];
  const turnEl = $('turn-label');
  if (game.phase === PHASE.DEPLOY) {
    const dpal = COLORS['p' + game.deployPlayer];
    turnEl.textContent = `Deploy: ${dpal.name} (${game.deployQueue.length} left)`;
    turnEl.style.color = dpal.fill;
  } else {
    turnEl.textContent = `${pal.name}'s Turn · Round ${game.turn}`;
    turnEl.style.color = pal.fill;
  }

  // Phase hint
  const phaseEl = $('phase-hint');
  if (game.phase === PHASE.DEPLOY) {
    const zone = game.deployPlayer === 1 ? 'blue (left) zone' : 'red (right) zone';
    phaseEl.textContent = `Click the ${zone} to place each unit`;
    phaseEl.style.color = COLORS['p' + game.deployPlayer].fill;
  } else {
    phaseEl.textContent = '';
  }

  // Selected unit info
  const sel    = game.selectedUnit;
  const infoEl = $('unit-info');
  if (sel) {
    const hpPct  = Math.round(sel.hp / sel.def.maxHp * 100);
    const mode   = game.pendingAction;
    const modeHint = mode ? `<div class="sel-mode">▶ ${mode} — click target on map</div>` : '';
    const rallyHint= sel.hasRally()
      ? `<div class="sel-rally">📍 Rallying → (${sel.rallyX},${sel.rallyY})</div>` : '';
    infoEl.innerHTML = `
      <div class="sel-name">${sel.def.name}</div>
      <div class="sel-stat">HP: ${sel.hp}/${sel.def.maxHp} (${hpPct}%)</div>
      <div class="sel-stat">Spd:${sel.def.moveSpeed} · Dmg:${sel.def.damage} · Rng:${sel.def.attackRange}</div>
      ${rallyHint}${modeHint}`;

    $('btn-move').disabled   = false;
    $('btn-attack').disabled = false;
    $('btn-charge').style.display   = sel.def.canCharge   ? '' : 'none';
    $('btn-instruct').style.display = sel.def.canInstruct ? '' : 'none';
    $('btn-charge').disabled   = sel.hasMoved;   // can't start charge if already moved
    $('btn-instruct').disabled = false;
  } else {
    infoEl.innerHTML = '<em>Click one of your units</em>';
    $('btn-move').disabled   = true;
    $('btn-attack').disabled = true;
    $('btn-charge').style.display   = 'none';
    $('btn-instruct').style.display = 'none';
  }

  // Army status
  for (const p of [1, 2]) {
    const el    = $(`army-status-${p}`);
    const alive = game.aliveUnits(p);
    const total = game.armies[p].length;
    const byType = {};
    for (const u of alive) byType[u.type] = (byType[u.type] || 0) + 1;
    const breakdown = Object.entries(byType)
      .map(([t, n]) => `${UNIT_DEFS[t].abbr}×${n}`)
      .join(' ');
    el.innerHTML = `<strong>${alive.length}/${total}</strong>${breakdown ? ` · ${breakdown}` : ''}`;
  }

  // Combat log
  const logEl = $('combat-log');
  logEl.innerHTML = game.log.slice(0, 12).map(l => `<div class="log-line">${l}</div>`).join('');
}

// ─── Canvas click ─────────────────────────────────────────────────────────────
$('gameCanvas').addEventListener('click', e => {
  const rect   = e.target.getBoundingClientRect();
  const scaleX = e.target.width  / rect.width;
  const scaleY = e.target.height / rect.height;
  const px     = (e.clientX - rect.left) * scaleX;
  const py     = (e.clientY - rect.top)  * scaleY;
  const { col, row } = renderer.pixelToTile(px, py);

  if (col < 0 || col >= GRID_COLS) return;

  if (game.phase === PHASE.DEPLOY) {
    game.placeUnit(col, row);
  } else if (game.phase === PHASE.BATTLE) {
    game.handleBattleClick(col, row);
  }
});

// ─── Action buttons ───────────────────────────────────────────────────────────
$('btn-move').addEventListener('click',    () => game.setPendingAction(ACTION.MOVE));
$('btn-attack').addEventListener('click',  () => game.setPendingAction(ACTION.ATTACK));
$('btn-charge').addEventListener('click',  () => game.setPendingAction(ACTION.CHARGE));
$('btn-instruct').addEventListener('click',() => game.setPendingAction(ACTION.INSTRUCT));
$('btn-end-turn').addEventListener('click',() => game.endTurn());

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (game.phase !== PHASE.BATTLE) return;
  if (e.key === 'm' || e.key === 'M') game.setPendingAction(ACTION.MOVE);
  if (e.key === 'a' || e.key === 'A') game.setPendingAction(ACTION.ATTACK);
  if (e.key === 'c' || e.key === 'C') game.setPendingAction(ACTION.CHARGE);
  if (e.key === 'i' || e.key === 'I') game.setPendingAction(ACTION.INSTRUCT);
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); game.endTurn(); }
  if (e.key === 'Escape') {
    game.selectedUnit  = null;
    game.pendingAction = null;
    game._emit();
  }
});

// ─── Game Over ────────────────────────────────────────────────────────────────
function showGameOver() {
  showScreen('gameover');
  const txt = $('winner-text');
  if (game.winner === 0) {
    txt.textContent = '🤝 Draw!';
    txt.style.color = '#f1c40f';
  } else {
    const pal = COLORS['p' + game.winner];
    txt.textContent = `${pal.name} Wins! 🎉`;
    txt.style.color = pal.fill;
  }
  $('battle-summary').innerHTML =
    `<p>Battle ended on Round ${game.turn}</p>
     <p>P1 survivors: ${game.aliveUnits(1).length} &nbsp;·&nbsp; P2 survivors: ${game.aliveUnits(2).length}</p>`;
}

$('btn-restart').addEventListener('click', () => {
  game.reset();
  // Re-enable lock buttons
  for (const p of [1, 2]) {
    const btn = $(`p${p}-lock`);
    btn.disabled = false;
    btn.classList.remove('locked');
    btn.textContent = 'Lock In Army';
  }
  buildSetupUI();
  refreshSetupUI();
  showScreen('setup');
});

// ─── Game event listener ─────────────────────────────────────────────────────
game.on(g => {
  if (g.phase === PHASE.SETUP) {
    refreshSetupUI();
  } else if (g.phase === PHASE.DEPLOY || g.phase === PHASE.BATTLE) {
    showScreen('battle');
    refreshBattleUI();
  } else if (g.phase === PHASE.GAME_OVER) {
    showGameOver();
  }
});

// ─── Render loop ──────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min(ts - lastTime, 100);
  lastTime = ts;

  renderer.updateAnimations(game, dt);

  if (game.phase !== PHASE.SETUP) {
    renderer.draw(game);
    refreshBattleUI();
  }

  requestAnimationFrame(loop);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
showScreen('setup');
buildSetupUI();
refreshSetupUI();
requestAnimationFrame(loop);
