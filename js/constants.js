// ─── Grid & Canvas ───────────────────────────────────────────────────────────
export const GRID_COLS = 40;
export const GRID_ROWS = 28;
export const TILE   = 20;   // pixels per tile
export const CANVAS_W = GRID_COLS * TILE; // 800
export const CANVAS_H = GRID_ROWS * TILE; // 560

// ─── Economy ─────────────────────────────────────────────────────────────────
export const BUDGET = 500;
export const DEPLOY_COLS = 8; // deployment zone width (each side)

// ─── Unit Definitions ────────────────────────────────────────────────────────
// Each soldier type is deliberately tuned:
//   Foot    – cheap anvil.  Short range AoE melee + defense aura for clustering.
//   Archer  – glass cannon. Extreme range, fragile up close.
//   Cavalry – speed demon.  Fastest unit; can CHARGE (move + attack same turn).
//   Planner – tactician.    Almost harmless alone; rallies groups to any point.
export const UNIT_DEFS = {
  FOOT: {
    id:               'FOOT',
    name:             'Foot Soldier',
    abbr:             'F',
    cost:             50,
    maxHp:            100,
    moveSpeed:        5,
    damage:           10,
    attackRange:      2,
    baseDefense:      5,    // own base DR
    defenseAura:      10,   // DR bonus given to each ally in aura radius
    defenseAuraRange: 2,
    aoeAttack:        true, // hits ALL enemies in range each attack
    shape:            'square',
    desc:             'Cheap frontline fighter.\nGrants +10 DR to allies within 2 tiles.',
  },
  ARCHER: {
    id:               'ARCHER',
    name:             'Archer',
    abbr:             'A',
    cost:             75,
    maxHp:            100,
    moveSpeed:        4,
    damage:           5,
    attackRange:      20,
    baseDefense:      0,
    aoeAttack:        false,
    meleePenaltyRange:3,    // if target ≤ 3 tiles → 50 % damage
    shape:            'triangle',
    desc:             'Long-range attacker (range 20).\n−50 % damage vs close targets (≤ 3 tiles).',
  },
  HORSE: {
    id:               'HORSE',
    name:             'Cavalry',
    abbr:             'C',
    cost:             100,
    maxHp:            100,
    moveSpeed:        20,
    damage:           10,
    attackRange:      4,
    baseDefense:      0,
    aoeAttack:        true,
    canCharge:        true,  // CHARGE action: move full speed AND attack in one turn
    chargeMultiplier: 1.5,
    shape:            'oval',
    desc:             'Fastest unit (speed 20).\nCHARGE action: move + attack at 1.5× damage.',
  },
  PLANNER: {
    id:               'PLANNER',
    name:             'Planner',
    abbr:             'P',
    cost:             125,
    maxHp:            100,
    moveSpeed:        1,
    damage:           1,
    attackRange:      2,
    baseDefense:      0,
    aoeAttack:        false,
    canInstruct:      true,
    instructRange:    10,
    shape:            'diamond',
    desc:             'Command unit (speed 1, damage 1).\nINSTRUCT: rally allies within 10 tiles to any point.',
  },
};

// ─── Visual ───────────────────────────────────────────────────────────────────
export const COLORS = {
  p1:      { fill: '#2980b9', stroke: '#1a5276', light: '#aed6f1', name: 'Player 1' },
  p2:      { fill: '#c0392b', stroke: '#78281f', light: '#f1948a', name: 'Player 2' },
  grid:    '#2c2c2c',
  gridLine:'#3a3a3a',
  zone1:   'rgba(41,128,185,0.12)',
  zone2:   'rgba(192,57,43,0.12)',
  moveHL:  'rgba(52,152,219,0.35)',
  attackHL:'rgba(231,76,60,0.35)',
  instructHL:'rgba(46,204,113,0.35)',
  select:  '#f1c40f',
  acted:   0.45,  // opacity for already-acted units
  rally:   'rgba(46,204,113,0.6)',
};

// ─── Phases & Actions ────────────────────────────────────────────────────────
export const PHASE = {
  SETUP:      'SETUP',
  DEPLOY:     'DEPLOY',
  BATTLE:     'BATTLE',
  ANIMATING:  'ANIMATING',
  GAME_OVER:  'GAME_OVER',
};

export const ACTION = {
  MOVE:     'MOVE',
  ATTACK:   'ATTACK',
  INSTRUCT: 'INSTRUCT',
  CHARGE:   'CHARGE',
};

// ─── Animation durations (ms) ────────────────────────────────────────────────
export const ANIM = {
  MOVE:       420,   // unit glide to new tile
  PROJECTILE: 380,   // arrow / slash travel time
  DAMAGE:     250,   // damage flash on hit
  DEATH:      600,   // fade-out on death
  RALLY:      500,   // rally ripple
};
