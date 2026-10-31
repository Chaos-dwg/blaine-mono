// The waste lands as a pixel grid. A terminal cell shows two pixels: an upper-half
// block's foreground on top, its background below, which makes the pixels square.
const UPPER_HALF = 0x2580
const TILE = 512 // Terrain repeats every TILE columns.
const PYLON_GAP = 28
const BODY_ROWS = 6

export const MIN_ROWS = BODY_ROWS // The rail needs six pixels below it, the train six above.
export const FAST = 3 // Foreground pixels per tick; slower layers are fractions of it.
const ALERT_AT = 0.8 // Of the way to Topeka: Blaine's windows go pink here.

// Context as a trip: tokens in the window now, and Topeka, where compaction runs.
export type Reading = { tokens: number; topeka: number }

export const tripOf = (reading?: Reading) => (reading === undefined ? 0 : Math.min(1, reading.tokens / reading.topeka))
export const isAlert = (trip: number) => trip >= ALERT_AT
export const short = (tokens: number) =>
  tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1).replace('.0', '')}M` : `${Math.round(tokens / 1000)}k`

const SKY = [0x120a14, 0x1e0e1a, 0x34141e, 0x561c20, 0x82291f, 0xb04224, 0xd8662c, 0xf0943c]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const SMOG = 0x1c0d18
const SUN = 0xffd27a
const SUN_RIM = 0xf5a94a
const LUD = 0x2e1522
const LUD_WINDOW = 0x9c5a2a
const DUNE = 0x1a0c14
const GROUND = 0x22101a
const GROUND_DARK = 0x180b12
const RUBBLE = 0x4a2626
const PYLON = 0x34323a
const PYLON_LIT = 0x5a565e
const RAIL = 0x8a8890
const RAIL_UNDER = 0x3e3c44
const RAIL_TICK = 0x56545c
const SPARK = 0xffe08a
const SIGN = 0xe8dcc8

// Blaine, top row to bottom: a long bullet nose, a blunt tail, lit from above.
const BODY = [0xffc2da, 0xf986b4, 0xf986b4, 0xe9689f, 0xc44a82, 0x7c2a5a]
const NOSE_TAPER = [13, 8, 4, 1, 0, 2]
const TAIL_TAPER = [4, 2, 1, 0, 0, 1]
const WINDOW_ROW = 2
const WINDOW = 0xbfe8ff
const WINDOW_DIM = 0x3f6fa8
const WINDOW_PINK = 0xff5fa0
const EYE = 0x1a2450
const EYE_GLINT = 0xdff3ff

function noise(a: number, b = 0): number {
  let x = Math.imul(a ^ Math.imul(b, 0x2f0b4c87) ^ 0x9e3779b9, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32
}

// Lud's skyline: broken towers, some sheared off on a slant.
const lud = new Uint8Array(TILE)
for (let x = 0, n = 0; x < TILE; n += 1) {
  const width = 3 + Math.floor(noise(n, 1) * 7)
  const height = 2 + Math.floor(noise(n, 2) * noise(n, 3) * 11)
  const shear = noise(n, 4) < 0.4 ? 1 : 0
  for (let i = 0; i < width && x + i < TILE; i += 1) {
    lud[x + i] = Math.max(1, height - shear * i)
  }
  x += width + Math.floor(noise(n, 5) * 4)
}

// Low dunes with the odd dead tree standing out of them.
const dunes = new Uint8Array(TILE)
for (let x = 0; x < TILE; x += 1) {
  const a = (x / TILE) * Math.PI * 2
  dunes[x] = Math.round(1.5 + Math.sin(a * 7) + 0.6 * Math.sin(a * 23)) + (noise(x, 6) < 0.015 ? 2 : 0)
}

// Blaine leaves Lud at the left edge and pulls into Topeka at the right.
function span(w: number, trip: number) {
  const length = Math.min(Math.floor(w * 0.36), 48)
  const tail = Math.round(trip * (w - 1 - length))

  return { length, tail, nose: tail + length }
}

function train(px: Uint32Array, w: number, railY: number, t: number, isMoving: boolean, trip: number): void {
  const { tail, nose } = span(w, trip)

  for (let r = 0; r < BODY_ROWS; r += 1) {
    const y = railY - BODY_ROWS + r
    for (let x = tail + TAIL_TAPER[r]; x <= nose - NOSE_TAPER[r]; x += 1) {
      px[y * w + x] = BODY[r]
    }
  }

  const windowY = railY - BODY_ROWS + WINDOW_ROW
  for (let x = tail + 5, n = 0; x < nose - 17; x += 7, n += 1) {
    const color = isAlert(trip) ? WINDOW_PINK : noise(n, 7) < 0.3 ? WINDOW_DIM : WINDOW
    px.fill(color, windowY * w + x, windowY * w + x + 5)
  }

  // A slanted black eye under the nose's brow.
  px.fill(EYE, (windowY - 1) * w + nose - 11, (windowY - 1) * w + nose - 7)
  px.fill(EYE, windowY * w + nose - 13, windowY * w + nose - 5)
  px[windowY * w + nose - 7] = EYE_GLINT

  if (!isMoving) return

  for (let x = nose + 1; x < Math.min(w - 1, nose + 7); x += 2) {
    px[(railY - 2) * w + x + (t & 1)] = SPARK
  }
  for (let r = 1; r < BODY_ROWS; r += 1) {
    const y = railY - BODY_ROWS + r
    for (let x = Math.max(0, tail - 22); x < tail; x += 1) {
      if ((x + t * 5 + r * 11) % 17 < 5) px[y * w + x] = BODY[r]
    }
  }
}

// One frame as 0xRRGGBB pixels, row-major. `t` counts ticks; the scene never reads a clock.
export function paint(w: number, h: number, t: number, isMoving: boolean, trip = 0): Uint32Array {
  const px = new Uint32Array(w * h)
  const horizon = h - 4
  const railY = h - 6
  const sunX = Math.floor(w * 0.14)
  const sunY = horizon - 3

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color: number
      if (y >= horizon) {
        const ground = (x + t * FAST) >>> 0
        const near = y >= h - 2
        color = noise(near ? ground : x + t * 2, y) < 0.06 ? RUBBLE : (x + y) & 1 ? GROUND : GROUND_DARK
      } else {
        const shade = (y / horizon) * (SKY.length - 1) + BAYER[(y & 3) * 4 + (x & 3)] / 16
        color = SKY[Math.min(SKY.length - 1, Math.floor(shade))]

        const sunDistance = Math.hypot(x - sunX, (y - sunY) * 1.1)
        if (sunDistance < 5.5 && !(y > sunY && y & 1)) {
          color = sunDistance < 4.2 ? SUN : SUN_RIM
        }
        if (y > 0 && y < 7 && noise((x + (t >> 2) + y * 37) >> 3, y) > 0.72) color = SMOG

        const farX = (x + (t >> 2)) % TILE
        const skyline = horizon - lud[farX]
        if (y >= skyline) {
          color = y > skyline && noise(farX >> 1, y >> 1) < 0.1 ? LUD_WINDOW : LUD
        }
        if (y >= horizon - dunes[(x + (t >> 1)) % TILE]) color = DUNE
      }

      const rail = (x + t * FAST) % PYLON_GAP
      if (y > railY && rail < 2) color = rail === 0 ? PYLON_LIT : PYLON
      if (y === railY) color = RAIL
      if (y === railY + 1) color = (x + t * FAST) % 4 === 0 ? RAIL_TICK : RAIL_UNDER
      px[y * w + x] = color
    }
  }

  train(px, w, railY, t, isMoving, trip)

  if (isMoving) {
    for (let x = 0; x < w; x += 1) {
      if (noise(x, t) < 0.012) px[(railY + 1) * w + x] = SPARK
    }
  }
  return px
}

// `cells` as RasterProps packs them: base64 of [codePoint, foreground, background] per cell.
// Letters sit in their own cells: LUD and TOPEKA on the top row, the token count over the train.
export function frame(columns: number, rows: number, t: number, isMoving: boolean, reading?: Reading): string {
  const trip = tripOf(reading)
  const px = paint(columns, rows * 2, t, isMoving, trip)
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < columns * rows; i += 1) {
    const top = Math.floor(i / columns) * 2 * columns + (i % columns)
    cells[i * 3] = UPPER_HALF
    cells[i * 3 + 1] = px[top]
    cells[i * 3 + 2] = px[top + columns]
  }

  const color = isAlert(trip) ? WINDOW_PINK : SIGN
  const write = (text: string, row: number, start: number) => {
    for (let k = 0; k < text.length; k += 1) {
      cells[(row * columns + start + k) * 3] = text.charCodeAt(k)
      cells[(row * columns + start + k) * 3 + 1] = color
    }
  }
  const topeka = reading === undefined ? 'TOPEKA' : `TOPEKA ${short(reading.topeka)}`
  write('LUD', 0, 0)
  write(topeka, 0, columns - topeka.length)

  const labelRow = rows - BODY_ROWS - 1 // The cell row just above the train's roof.
  if (reading !== undefined && labelRow >= 1) {
    const { length, tail } = span(columns, trip)
    const label = short(reading.tokens)
    write(label, labelRow, Math.max(0, Math.min(columns - label.length, tail + ((length - label.length) >> 1))))
  }
  return new Uint8Array(cells.buffer).toBase64()
}
