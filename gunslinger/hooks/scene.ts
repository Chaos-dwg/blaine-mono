// The Mohaine Desert as a pixel grid, packed the way blaine-mono packs the waste lands:
// a terminal cell shows two pixels, an upper-half block's foreground on top, its background below.
const UPPER_HALF = 0x2580
const TILE = 512 // Terrain repeats every TILE columns.
const FAST = 2 // Ground pixels per tick; the mountains move at a quarter of it.
const MARKER_GAP = 46 // Stones of the old coach road.
const FIGURE_ROWS = 10
const ROLAND_W = 8
const MIB_W = 6

export const MIN_ROWS = 7 // Ten-pixel figures with the sign row above them.
export const SHOT_TICKS = 18 // Draw, fire, holster.
export const FIRE = 4 // Ticks into a draw when the gun goes off.
export const IDLE_GAP = 360 // Ticks of work between idle draws, about 24 seconds.
export const CARD_TICKS = 45 // While the summary is written, a card is dealt about every three seconds.
const DEAL_TICKS = 8 // A card's flight from his hand to the table, face down...
const FLIP_TICKS = 2 // ...and its turn, edge on.
export const DEALT = DEAL_TICKS + FLIP_TICKS // From his hand to face up.
const FAST_GAP = 12 // Once the summary is done, the cards left come this quickly...
const HOLD = 20 // ...and the Tower lies this long before the night comes down.
export const WAKE_TICKS = 75 // The long night and the dawn after it, about five seconds.
const DAWN_AT = 25 // Ticks into the wake when the sky starts to lighten.
const NIGHT = 0.22 // How much daylight the golgotha keeps.
const ALERT_AT = 0.8 // Of the way to compaction: the signs go red here.
const CAMP_AT = 0.5 // With less daylight than this he sits down for the night.
export const VOLLEY = 4 // Ticks between his shots when more than one thing comes for him.

// Context as a chase: tokens in the window now, the window itself (where the man in black
// walks), and the compaction point (the golgotha), short of the window when auto-compact is on.
export type Reading = { tokens: number; window: number; compactAt: number }
// One draw: `at` is the tick it began. An error brings a slow mutant (a lobstrosity at night);
// an idle draw fires downrange by day. `foes` is how many come at once: the harder the 5 hour
// limit has been pressed, the more.
export type Shot = { at: number; kind: 'error' | 'idle'; foes?: number }
// What the world outside the context window says: the hour on the local clock (0 to 24, 14.5 is
// half past two), what the session has cost in dollars, and how much of the 5 hour limit is spent.
// `flare` is how many ticks since the 5 hour limit reset: his fire leaps up for FLARE_TICKS.
export type World = { hour?: number; cost?: number; limit?: number; flare?: number }
export const FLARE_TICKS = 45

export const shotEnds = (shot: Shot) => SHOT_TICKS + VOLLEY * ((shot.foes ?? 1) - 1)
export const foesFor = (limit?: number) => (limit === undefined ? 1 : limit >= 80 ? 3 : limit >= 50 ? 2 : 1)

// Daylight on the local clock, from the NIGHT it keeps to 1: dawn comes up from five to six,
// and dusk goes down from eight to nine.
export function daylight(hour: number) {
  const up = hour < 12 ? hour - 5 : 21 - hour

  return NIGHT + (1 - NIGHT) * Math.max(0, Math.min(1, up))
}
// A compaction as the palaver at the golgotha: `at` is the tick it began, `doneAt` the tick a
// compaction that stood finished. The reading ends on the Tower, then the long night ends in
// dawn over the man in black's bones.
export type Palaver = { at: number; doneAt?: number }

export const isAlert = (reading?: Reading) => reading !== undefined && reading.tokens >= ALERT_AT * reading.compactAt
export const short = (tokens: number) =>
  tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1).replace('.0', '')}M` : `${Math.round(tokens / 1000)}k`

// Bleached noon over white alkali hardpan, as the book has it.
const SKY = [0x2c5d96, 0x3d70a8, 0x5486ba, 0x6f9cc8, 0x8eb3d4, 0xaec8de, 0xcddbe4, 0xe8e6da]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const SUN = 0xfffdf2
const SUN_RIM = 0xfff0b8
const MOUNTAIN = 0xb4bcc6
const HARDPAN = 0xebe4d2
const HARDPAN_DARK = 0xe2dac6
const HARDPAN_FAR = 0xd6cdb6
const CRACK = 0xc4b89e
const SHADOW = 0xc9bfa6
const GRASS = 0x6f7d3e
const STONE = 0x9b9384
const STONE_LIT = 0xb5ad9c
const FLASH = 0xffb347
const FLASH_CORE = 0xfff3b0
const SMOKE = 0xd8d8d0
const DUST = 0xa8916a
const SIGN = 0xfff4dc
const ALERT = 0xff6040
const INK_DARK = 0x2a1d14 // Letters over the sun or the haze read in dark ink.
const ALERT_DARK = 0xa01a10
const STAR = 0xdfe6ff
const MOON = 0xe8ecf8

const INK: Record<string, number> = {
  h: 0x3a2516, // Roland's hair: he lost his hat in the desert.
  s: 0xc98d63,
  c: 0x8d98a0, // A shirt the colour of rain or dust.
  C: 0x6d777f,
  b: 0x5a381e, // Crossed gunbelts...
  y: 0xe0b04a, // ...with brass in their loops.
  g: 0xd9b46a, // Sandalwood grips.
  m: 0x3a4150,
  j: 0x4d6587,
  k: 0x3b2a1e,
  w: 0x8c6a42, // The hide waterbag.
  R: 0x15121c, // The man in black.
  r: 0x3a2c4d,
  f: 0x0b0a0e,
  G: 0x4f8f5a, // A slow mutant.
  L: 0x9dff8a,
  S: 0xf2ede0, // The golgotha.
  E: 0x2a2420,
  o: 0x8a8070,
  p: 0xd8cfc0, // The man in black's face, seen across the fire.
  l: 0x6e3a22,
  F: 0xff7a1a, // A devil-grass fire...
  Y: 0xffd84a,
  B: 0x4a3220,
  a: 0x6a645a, // ...and its ash.
  K: 0xf3ead2, // Tarot cards.
  d: 0x1c2240,
  q: 0x8a5a2a,
  v: 0x3f8fd8,
  x: 0xc8302c,
  z: 0x0a0a0a,
  O: 0xc4552b, // A lobstrosity's shell...
  P: 0xe8794a,
}

const ROLAND = ['...hhh..', '...hss..', '....s...', '..ccccc.', '..cCccc.', '..cCccs.', '.wbyybg.', '..jjjj..']
const ROLAND_AIM = ['...hhh..', '...hss..', '....s...', '..ccccc.', '..cCccccsmm', '..cCccc.', '.wbyybb.', '..jjjj..']
const ROLAND_LEGS = [
  ['..j..j..', '.kk..kk.'],
  ['...jj...', '...kk...'],
]
const MIB = ['..rr..', '.rRRr.', '.rRRR.', '.RRRR.', 'rRRRR.', 'RRRRRR', 'RRRRRR', 'RRRRRR', '.RRRR.']
const MIB_FEET = [['.f..f.'], ['..ff..']]
const MUTANT = ['.GG.', 'LGLG', 'GGG.', 'GGGG', '.GGG', '.G.G', 'G..G']
const MUTANT_DOWN = ['.GGG..', 'LGGGGG']
const SKULL = ['.ooo.', 'oSSSo', 'SESES', 'oSSSo', '.SoS.']

// A night alone: Roland sits at his own fire, and what crawls up out of the dark is a lobstrosity.
const LOB = ['O..OO..O', 'OO.OO.OO', '.OPOOPO.', 'OOOOOOOO', '.O.OO.O.']
const LOB_DOWN = ['..OOOO..', 'O.O..O.O']
const LOB_W = 8
const ROLAND_SIT_AIM = ['...hhh..', '...hss..', '....s...', '..ccccc.', '..cCccccsmm', '.wbyybg.', '..jjjjjk']
// His fire is the 5 hour limit: big while it is fresh, down to embers as it runs out.
const FIRES = {
  big: [
    ['..Y..', '.YFY.', 'YFFFY', 'FFFFF', 'BBBBB'],
    ['.Y...', '.YFY.', 'FYFFY', 'FFFFF', 'BBBBB'],
    ['...Y.', '.YFY.', 'YFFYF', 'FFFFF', 'BBBBB'],
  ],
  mid: [['.Y.', 'FYF', 'BBB'], ['Y..', 'FFY', 'BBB'], ['..Y', 'YFF', 'BBB']],
  small: [['.F.', 'BBB'], ['F..', 'BBB'], ['..F', 'BBB']],
  embers: [['aFa'], ['aBa'], ['aFa']],
} as const
// The man in black's own fire, a long way off at the window's edge.
const FAR_FIRE = ['.Y.', 'FFF']
const fireSize = (limit?: number) =>
  limit === undefined ? 'mid' : limit < 33 ? 'big' : limit < 67 ? 'mid' : limit < 90 ? 'small' : 'embers'
const GLOW_REACH = { big: 12, mid: 9, small: 6, embers: 3 } as const

// The palaver: the two of them sat either side of a fire while the man in black reads the cards.
const ROLAND_SIT = ['...hhh..', '...hss..', '....s...', '..ccccc.', '..cCccs.', '.wbyybg.', '..jjjjjk']
const MIB_SIT = ['..rr..', '.lRRr.', '.pRRr.', '.lRRR.', 'lRRRRR', 'lRRRRR', 'fRRRRR'] // Firelight on his robe.
const FLAMES = [
  ['.Y.', 'FYF', 'BBB'],
  ['Y..', 'FFY', 'BBB'],
  ['..Y', 'YFF', 'BBB'],
]
const ASH = ['aBa']
const BONES = ['.SS......', 'SESoSoSoS']
const CARD_ROWS = 7
const card = (art: readonly string[]) => ['KKKKK', ...art.map(row => `K${row.replaceAll('.', 'd')}K`), 'KKKKK']
const CARD_BACK = card(['x.x', '.x.', 'x.x', '.x.', 'x.x'])
const CARD_EDGE = Array<string>(CARD_ROWS).fill('K')
// The reading from the book, in its order: the last card stays on the table.
const CARDS = [
  { name: 'THE SAILOR', art: card(['.K.', '.KK', 'KKK', 'qqq', 'vvv']) },
  { name: 'THE PRISONER', art: card(['K.K', 'K.K', 'KsK', 'K.K', 'K.K']) },
  { name: 'THE LADY OF SHADOWS', art: card(['KKz', 'KKz', 'KKz', 'xzx', 'x.x']) },
  { name: 'DEATH', art: card(['KKK', 'zKz', 'KKK', '.K.', 'K.K']) },
  { name: 'THE TOWER', art: card(['.o.', '.o.', 'oxo', 'ooo', 'ooo']) },
] as const
const WAKE_TEXT = 'TEN YEARS LATER'

// The tick card `n` leaves his hand: one every CARD_TICKS while the summary is written, and
// the rest in quick succession once it is done, so the Tower always closes the reading.
function dealAt(n: number, { at, doneAt }: Palaver) {
  const begun = doneAt === undefined ? CARDS.length : Math.min(CARDS.length, Math.floor((doneAt - at) / CARD_TICKS) + 1)
  if (n < begun || doneAt === undefined) return at + n * CARD_TICKS

  return Math.max(doneAt, at + (begun - 1) * CARD_TICKS + FAST_GAP) + (n - begun) * FAST_GAP
}

// The tick the long night begins, once the compaction is done and the Tower has lain a while.
export function wakeAt(palaver: Palaver) {
  return palaver.doneAt === undefined
    ? undefined
    : Math.max(palaver.doneAt, dealAt(CARDS.length - 1, palaver) + DEALT + HOLD)
}

// Ticks since the long night began; negative while the cards are still being read.
function sinceWake(t: number, palaver?: Palaver) {
  const wake = palaver && wakeAt(palaver)

  return wake === undefined ? -1 : t - wake
}

// The card lying face up last, the one named over the fire.
const faceUp = (t: number, palaver: Palaver) => CARDS.findLast((_, n) => t - dealAt(n, palaver) >= DEALT)

// Night toward a colour: darker, and bluer as it darkens. `light` 1 leaves it as it is.
function dim(color: number, light: number) {
  const r = Math.round(((color >> 16) & 255) * light)
  const g = Math.round(((color >> 8) & 255) * light)
  const b = Math.round((color & 255) * (light + 0.25 * (1 - light)))

  return (r << 16) | (g << 8) | b
}

function noise(a: number, b = 0): number {
  let x = Math.imul(a ^ Math.imul(b, 0x2f0b4c87) ^ 0x9e3779b9, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32
}

// Faint mountains along the horizon, the ones the man in black is making for.
const ridge = new Uint8Array(TILE)
for (let x = 0; x < TILE; x += 1) {
  const a = (x / TILE) * Math.PI * 2
  ridge[x] = Math.max(0, Math.round(1.2 + 1.8 * Math.sin(a * 5) + 0.8 * Math.sin(a * 17)))
}

function dot(px: Uint32Array, w: number, x: number, y: number, color: number) {
  if (x >= 0 && x < w && y >= 0 && y * w < px.length) px[y * w + x] = color
}

function stamp(px: Uint32Array, w: number, art: readonly string[], x0: number, y0: number) {
  art.forEach((line, r) => {
    for (let c = 0; c < line.length; c += 1) {
      const color = INK[line.charAt(c)]
      if (color !== undefined) dot(px, w, x0 + c, y0 + r, color)
    }
  })
}

// Where each figure stands: Roland by the tokens in context, the man in black at the window's
// edge, the golgotha at the compaction point when that falls short of the window.
export function places(w: number, reading?: Reading) {
  const mib = w - MIB_W - 1
  const room = mib - ROLAND_W - 3
  if (reading === undefined) return { roland: 0, mib, golgotha: undefined }

  const at = (tokens: number) => Math.round(Math.min(1, tokens / reading.window) * room)

  return { roland: at(reading.tokens), mib, golgotha: reading.compactAt < reading.window ? at(reading.compactAt) + 2 : undefined }
}

// The golgotha, drawn over the darkened desert: the fire and the cards while the compaction
// runs, then ash, bones, and Roland getting to his feet as the sky lightens.
function golgotha(px: Uint32Array, w: number, feet: number, t: number, palaver: Palaver) {
  const cx = Math.floor(w / 2)
  const since = sinceWake(t, palaver)
  const seated = feet - ROLAND_SIT.length + 1

  if (since < 0) {
    stamp(px, w, FLAMES[(t >> 1) % FLAMES.length] ?? [], cx - 1, feet - 2)
    stamp(px, w, ROLAND_SIT, cx - 10, seated)
    stamp(px, w, MIB_SIT, cx + 3, feet - MIB_SIT.length + 1)

    // Each card flies face down from his hand to its place in the spread, turns edge on, and
    // lands face up. The spread keeps clear of the two of them; the Tower takes the middle.
    const hand = { x: cx + 2, y: feet - 6 }
    const row = feet - 3 - CARD_ROWS
    const spread = [cx - 21, cx - 15, cx + 10, cx + 16, cx - 2]
    CARDS.forEach(({ art }, n) => {
      const s = t - dealAt(n, palaver)
      const x = spread[n] ?? cx
      if (s < 0) return
      if (s < DEAL_TICKS) {
        const k = s / DEAL_TICKS
        stamp(px, w, CARD_BACK, Math.round(hand.x + (x - hand.x) * k), Math.round(hand.y + (row - hand.y) * k))
      } else if (s < DEALT) {
        stamp(px, w, CARD_EDGE, x + 2, row)
      } else {
        stamp(px, w, art, x, row)
      }
    })
    return
  }

  stamp(px, w, ASH, cx - 1, feet)
  stamp(px, w, BONES, cx + 2, feet - 1)
  if (since < DAWN_AT + 15) {
    stamp(px, w, ROLAND_SIT, cx - 10, seated)
  } else {
    stamp(px, w, ROLAND, cx - 10, feet - FIGURE_ROWS + 1)
    stamp(px, w, ROLAND_LEGS[1] ?? [], cx - 10, feet - FIGURE_ROWS + 1 + ROLAND.length)
  }
}

// One frame as 0xRRGGBB pixels, row-major. `t` counts ticks; the scene never reads a clock.
export function paint(
  w: number,
  h: number,
  t: number,
  isMoving: boolean,
  reading?: Reading,
  shot?: Shot,
  palaver?: Palaver,
  world: World = {},
): Uint32Array {
  const px = new Uint32Array(w * h)
  const horizon = h - 5
  const feet = h - 2
  const top = feet - FIGURE_ROWS + 1
  const sunX = Math.floor(w * 0.68)
  const sunY = 2
  const since = sinceWake(t, palaver)
  const isGolgotha = palaver !== undefined && since < WAKE_TICKS
  const day = world.hour === undefined ? 1 : daylight(world.hour) // What the clock leaves of the day.
  const light = !isGolgotha ? day : since < DAWN_AT ? NIGHT : NIGHT + (day - NIGHT) * Math.min(1, (since - DAWN_AT) / 35)
  const isCamp = !isGolgotha && day < CAMP_AT
  const go = isGolgotha ? palaver.at : isCamp ? 0 : t // The desert stops passing while they sit.

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color: number
      if (y >= horizon) {
        const ground = (x + go * FAST) >>> 0
        color = y === horizon ? HARDPAN_FAR : noise(ground, y) < 0.07 ? CRACK : (x + y) & 1 ? HARDPAN : HARDPAN_DARK
      } else {
        const shade = (y / horizon) * (SKY.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] ?? 0) / 16
        color = SKY[Math.min(SKY.length - 1, Math.floor(shade))] ?? SUN

        const sunDistance = Math.hypot(x - sunX, (y - sunY) * 1.1)
        if (light > 0.9 && sunDistance < 3.6) color = sunDistance < 2.6 ? SUN : SUN_RIM
        if (y >= horizon - (ridge[(x + (go >> 2)) % TILE] ?? 0)) color = MOUNTAIN
      }
      px[y * w + x] = color
    }
  }

  // The old coach road's stones and clumps of devil-grass, passing as Roland walks.
  for (let x = 0; x < w; x += 1) {
    const ground = (x + go * FAST) >>> 0
    if (ground % MARKER_GAP < 2) {
      for (let y = horizon - 2; y <= horizon; y += 1) dot(px, w, x, y, y === horizon - 2 ? STONE_LIT : STONE)
    } else if (noise(ground, 9) < 0.035) {
      const y = horizon + 1 + Math.floor(noise(ground, 10) * 3)
      dot(px, w, x, y, GRASS)
      dot(px, w, x, y - 1, GRASS)
    }
  }

  const at = places(w, reading)
  const flare = world.flare !== undefined && world.flare < FLARE_TICKS ? world.flare : undefined
  const size = flare === undefined ? fireSize(world.limit) : 'big'
  const fireX = Math.min(at.roland + 13, w - 7)
  // Where firelight falls: the golgotha's fire while the cards are read (it burns only then), or at
  // a camp his own fire, by the limit, and the man in black's far off.
  const fires: (readonly [number, number])[] = isGolgotha
    ? since < 0 ? [[Math.floor(w / 2), 9]] : []
    : isCamp ? [[fireX + 2, GLOW_REACH[size] + (flare === undefined ? 0 : Math.round(8 * (1 - flare / FLARE_TICKS)))], [at.mib + 1, 4]] : []

  if (light < 1) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const glow = Math.max(0, ...fires.map(([fx, reach]) => 0.8 * (1 - Math.hypot(x - fx, (y - feet) * 1.6) / reach)))
        const isStar = light < 0.5 && y < horizon - 4 && noise(x * 31 + y, 11) < 0.02 && noise(x, t >> 3) < 0.85
        px[y * w + x] = isStar ? STAR : dim(px[y * w + x] ?? 0, Math.max(light, glow))
      }
    }
  }
  if (light < CAMP_AT) {
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < w; x += 1) if (Math.hypot(x - sunX, (y - sunY) * 1.1) < 2.4) px[y * w + x] = MOON
    }
  }
  if (isGolgotha) {
    golgotha(px, w, feet, t, palaver)
    return px
  }

  const step = isMoving ? (t >> 2) & 1 : 1
  const phase = shot === undefined ? -1 : t - shot.at
  const volley = shot === undefined ? 0 : shotEnds(shot)
  const isAiming = phase >= 1 && phase < volley - 3
  const foes = shot?.foes ?? 1

  if (at.golgotha !== undefined) stamp(px, w, SKULL, at.golgotha, feet - SKULL.length + 1)

  if (isCamp) {
    const fire = FIRES[size][(t >> 1) % 3] ?? []
    stamp(px, w, fire, fireX + 2 - ((fire[0]?.length ?? 0) >> 1), feet - fire.length + 1)
    // Sparks climb off it as it leaps.
    for (let i = 0; flare !== undefined && i < 8; i += 1) {
      const rise = (flare * 0.7 + i * 4) % 14
      dot(px, w, fireX + 2 + Math.round(Math.sin(i * 2.3 + flare * 0.2) * 3), feet - 5 - Math.round(rise), rise < 10 ? 0xffd84a : 0xff7a1a)
    }
    stamp(px, w, FAR_FIRE, at.mib + 1, feet - 1)
    stamp(px, w, isAiming ? ROLAND_SIT_AIM : ROLAND_SIT, at.roland, feet - ROLAND_SIT.length + 1)
  } else {
    for (let x = 0; x < ROLAND_W; x += 1) dot(px, w, at.roland + x, feet + 1, SHADOW)
    for (let x = 0; x < MIB_W; x += 1) dot(px, w, at.mib + x, feet + 1, SHADOW)

    stamp(px, w, MIB, at.mib, top)
    stamp(px, w, MIB_FEET[isMoving ? 1 - step : 1] ?? [], at.mib, top + MIB.length)
    stamp(px, w, isAiming ? ROLAND_AIM : ROLAND, at.roland, top)
    stamp(px, w, ROLAND_LEGS[step] ?? [], at.roland, top + ROLAND.length)
  }

  if (shot !== undefined && phase >= 0 && phase < volley) {
    const muzzleX = at.roland + 11
    const muzzleY = isCamp ? feet - 2 : top + 4

    // He fires at each one in turn, VOLLEY ticks apart; `p` is the tick of his shot at this one.
    for (let i = 0; i < foes; i += 1) {
      const p = phase - i * VOLLEY
      const isStanding = p <= FIRE + 1
      const isDown = !isStanding && phase < volley - 4

      if (isCamp) {
        // A lobstrosity scuttles in from the dark toward the fire, and goes over on its back.
        const base = Math.min(fireX + 9 + 10 * i, w - LOB_W - 1 - 10 * (foes - 1 - i))
        const x = Math.min(w - LOB_W, base + Math.max(0, (FIRE + 1 - phase) * 2))
        if (isStanding) stamp(px, w, LOB, x, feet - LOB.length + 1)
        else if (isDown) stamp(px, w, LOB_DOWN, x, feet - 1)
      } else if (shot.kind === 'error') {
        const x = Math.min(at.roland + ROLAND_W + 6 + i * 6, w - 5 - 6 * (foes - 1 - i))
        if (isStanding) stamp(px, w, MUTANT, x, feet - MUTANT.length + 1)
        else if (isDown) stamp(px, w, MUTANT_DOWN, x - 1, feet - 1)
      } else if (p > FIRE && p < SHOT_TICKS) {
        // Never within pistol shot: the round kicks up dust short of the man in black.
        const x = Math.round(muzzleX + (at.mib - muzzleX) * (0.6 - 0.1 * i))
        const r = (p - FIRE) >> 1
        for (let d = -r; d <= r; d += 1) dot(px, w, x + d, feet, DUST)
        if (r > 0) dot(px, w, x, feet - r, DUST)
      }

      if (p === FIRE || p === FIRE + 1) {
        for (const [dx, dy] of [[1, 0], [2, 0], [1, -1], [1, 1]] as const) dot(px, w, muzzleX + dx, muzzleY + dy, FLASH)
        dot(px, w, muzzleX, muzzleY, FLASH_CORE)
      } else if (p > FIRE + 1 && p < FIRE + 9) {
        const s = p - FIRE - 2
        dot(px, w, muzzleX + s, muzzleY - 1 - (s >> 1), SMOKE)
        dot(px, w, muzzleX + s + 1, muzzleY - 1 - (s >> 1), SMOKE)
      }
    }
  }
  return px
}

// `cells` as RasterProps packs them: base64 of [codePoint, foreground, background] per cell.
// Letters sit in their own cells: the man in black's sign on the top row, and over Roland the
// token count, or at the golgotha the card on the table and then the years he slept.
export function frame(
  columns: number,
  rows: number,
  t: number,
  isMoving: boolean,
  reading?: Reading,
  shot?: Shot,
  palaver?: Palaver,
  world: World = {},
): string {
  const h = rows * 2
  const px = paint(columns, h, t, isMoving, reading, shot, palaver, world)
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < columns * rows; i += 1) {
    const top = Math.floor(i / columns) * 2 * columns + (i % columns)
    cells[i * 3] = UPPER_HALF
    cells[i * 3 + 1] = px[top] ?? 0
    cells[i * 3 + 2] = px[top + columns] ?? 0
  }

  const since = sinceWake(t, palaver)
  const scene =
    palaver === undefined || since >= WAKE_TICKS ? undefined : since < 0 ? (faceUp(t, palaver)?.name ?? '') : WAKE_TEXT
  const isRed = isAlert(reading) && scene === undefined
  const write = (text: string, row: number, start: number, red = isRed) => {
    for (let k = 0; k < text.length; k += 1) {
      const i = (row * columns + start + k) * 3
      if (cells[i + 2] === STAR) cells[i + 2] = cells[i + 1] ?? 0 // A star behind a letter goes dark.
      const bg = cells[i + 2] ?? 0
      const isBright = ((bg >> 16) & 255) + ((bg >> 8) & 255) + (bg & 255) > 600
      cells[i] = text.charCodeAt(k)
      cells[i + 1] = red ? (isBright ? ALERT_DARK : ALERT) : isBright ? INK_DARK : SIGN
    }
  }
  const sign = reading === undefined ? 'MAN IN BLACK' : `MAN IN BLACK ${short(reading.window)}`
  write(sign, 0, Math.max(0, columns - sign.length))

  // What the session has cost, and how much of the 5 hour limit is spent, on the left of the top row.
  const spent = [
    world.cost === undefined ? '' : `$${world.cost.toFixed(world.cost < 100 ? 2 : 0)}`,
    world.limit === undefined ? '' : `5H ${Math.round(world.limit)}%`,
  ]
    .filter(Boolean)
    .join(' ')
  if (spent !== '' && spent.length + sign.length + 2 <= columns) write(spent, 0, 0, (world.limit ?? 0) >= ALERT_AT * 100)

  const labelRow = Math.floor((h - 1 - FIGURE_ROWS) / 2) - 1 // The cell row just above Roland's head.
  if (scene !== undefined && labelRow >= 1) {
    write(scene, labelRow, Math.max(0, (columns - scene.length) >> 1))
  } else if (reading !== undefined && labelRow >= 1) {
    const label = short(reading.tokens)
    const start = places(columns, reading).roland + ((ROLAND_W - label.length) >> 1)
    write(label, labelRow, Math.max(0, Math.min(columns - label.length, start)))
  }
  return new Uint8Array(cells.buffer).toBase64()
}
