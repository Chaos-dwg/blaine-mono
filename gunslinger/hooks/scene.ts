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
const ALERT_AT = 0.8 // Of the way to compaction: the signs go red here.

// Context as a chase: tokens in the window now, the window itself (where the man in black
// walks), and the compaction point (the golgotha), short of the window when auto-compact is on.
export type Reading = { tokens: number; window: number; compactAt: number }
// One draw: `at` is the tick it began. An error brings a slow mutant; an idle draw fires downrange.
export type Shot = { at: number; kind: 'error' | 'idle' }

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

// One frame as 0xRRGGBB pixels, row-major. `t` counts ticks; the scene never reads a clock.
export function paint(w: number, h: number, t: number, isMoving: boolean, reading?: Reading, shot?: Shot): Uint32Array {
  const px = new Uint32Array(w * h)
  const horizon = h - 5
  const feet = h - 2
  const top = feet - FIGURE_ROWS + 1
  const sunX = Math.floor(w * 0.68)
  const sunY = 2

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color: number
      if (y >= horizon) {
        const ground = (x + t * FAST) >>> 0
        color = y === horizon ? HARDPAN_FAR : noise(ground, y) < 0.07 ? CRACK : (x + y) & 1 ? HARDPAN : HARDPAN_DARK
      } else {
        const shade = (y / horizon) * (SKY.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] ?? 0) / 16
        color = SKY[Math.min(SKY.length - 1, Math.floor(shade))] ?? SUN

        const sunDistance = Math.hypot(x - sunX, (y - sunY) * 1.1)
        if (sunDistance < 3.6) color = sunDistance < 2.6 ? SUN : SUN_RIM
        if (y >= horizon - (ridge[(x + (t >> 2)) % TILE] ?? 0)) color = MOUNTAIN
      }
      px[y * w + x] = color
    }
  }

  // The old coach road's stones and clumps of devil-grass, passing as Roland walks.
  for (let x = 0; x < w; x += 1) {
    const ground = (x + t * FAST) >>> 0
    if (ground % MARKER_GAP < 2) {
      for (let y = horizon - 2; y <= horizon; y += 1) dot(px, w, x, y, y === horizon - 2 ? STONE_LIT : STONE)
    } else if (noise(ground, 9) < 0.035) {
      const y = horizon + 1 + Math.floor(noise(ground, 10) * 3)
      dot(px, w, x, y, GRASS)
      dot(px, w, x, y - 1, GRASS)
    }
  }

  const at = places(w, reading)
  const step = isMoving ? (t >> 2) & 1 : 1
  const phase = shot === undefined ? -1 : t - shot.at
  const isAiming = phase >= 1 && phase < SHOT_TICKS - 3

  if (at.golgotha !== undefined) stamp(px, w, SKULL, at.golgotha, feet - SKULL.length + 1)
  for (let x = 0; x < ROLAND_W; x += 1) dot(px, w, at.roland + x, feet + 1, SHADOW)
  for (let x = 0; x < MIB_W; x += 1) dot(px, w, at.mib + x, feet + 1, SHADOW)

  stamp(px, w, MIB, at.mib, top)
  stamp(px, w, MIB_FEET[isMoving ? 1 - step : 1] ?? [], at.mib, top + MIB.length)
  stamp(px, w, isAiming ? ROLAND_AIM : ROLAND, at.roland, top)
  stamp(px, w, ROLAND_LEGS[step] ?? [], at.roland, top + ROLAND.length)

  if (shot !== undefined && phase >= 0 && phase < SHOT_TICKS) {
    const muzzleX = at.roland + 11
    const muzzleY = top + 4

    if (shot.kind === 'error') {
      const x = Math.min(at.roland + ROLAND_W + 6, w - 5)
      if (phase <= FIRE + 1) stamp(px, w, MUTANT, x, feet - MUTANT.length + 1)
      else if (phase < SHOT_TICKS - 4) stamp(px, w, MUTANT_DOWN, x - 1, feet - 1)
    } else if (phase > FIRE) {
      // Never within pistol shot: the round kicks up dust short of the man in black.
      const x = Math.round(muzzleX + (at.mib - muzzleX) * 0.6)
      const r = (phase - FIRE) >> 1
      for (let d = -r; d <= r; d += 1) dot(px, w, x + d, feet, DUST)
      if (r > 0) dot(px, w, x, feet - r, DUST)
    }

    if (phase === FIRE || phase === FIRE + 1) {
      for (const [dx, dy] of [[1, 0], [2, 0], [1, -1], [1, 1]] as const) dot(px, w, muzzleX + dx, muzzleY + dy, FLASH)
      dot(px, w, muzzleX, muzzleY, FLASH_CORE)
    } else if (phase > FIRE + 1 && phase < FIRE + 9) {
      const s = phase - FIRE - 2
      dot(px, w, muzzleX + s, muzzleY - 1 - (s >> 1), SMOKE)
      dot(px, w, muzzleX + s + 1, muzzleY - 1 - (s >> 1), SMOKE)
    }
  }
  return px
}

// `cells` as RasterProps packs them: base64 of [codePoint, foreground, background] per cell.
// Letters sit in their own cells: the man in black's sign on the top row, the token count over Roland.
export function frame(columns: number, rows: number, t: number, isMoving: boolean, reading?: Reading, shot?: Shot): string {
  const h = rows * 2
  const px = paint(columns, h, t, isMoving, reading, shot)
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < columns * rows; i += 1) {
    const top = Math.floor(i / columns) * 2 * columns + (i % columns)
    cells[i * 3] = UPPER_HALF
    cells[i * 3 + 1] = px[top] ?? 0
    cells[i * 3 + 2] = px[top + columns] ?? 0
  }

  const isRed = isAlert(reading)
  const write = (text: string, row: number, start: number) => {
    for (let k = 0; k < text.length; k += 1) {
      const i = (row * columns + start + k) * 3
      const bg = cells[i + 2] ?? 0
      const isBright = ((bg >> 16) & 255) + ((bg >> 8) & 255) + (bg & 255) > 600
      cells[i] = text.charCodeAt(k)
      cells[i + 1] = isRed ? (isBright ? ALERT_DARK : ALERT) : isBright ? INK_DARK : SIGN
    }
  }
  const sign = reading === undefined ? 'MAN IN BLACK' : `MAN IN BLACK ${short(reading.window)}`
  write(sign, 0, Math.max(0, columns - sign.length))

  const labelRow = Math.floor((h - 1 - FIGURE_ROWS) / 2) - 1 // The cell row just above Roland's head.
  if (reading !== undefined && labelRow >= 1) {
    const label = short(reading.tokens)
    const start = places(columns, reading).roland + ((ROLAND_W - label.length) >> 1)
    write(label, labelRow, Math.max(0, Math.min(columns - label.length, start)))
  }
  return new Uint8Array(cells.buffer).toBase64()
}
