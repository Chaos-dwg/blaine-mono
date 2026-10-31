// The office as a pixel grid, drawn like the waste lands: a terminal cell shows two
// pixels through an upper-half block. Name labels are real letters in their own cells.
const UPPER_HALF = 0x2580

export const SLOT = 11 // Cells wide per desk; two fit the narrowest dock.
export const MAX_ROWS = 20 // The wall and three bands of desks, each with a label row.
export const FLIGHT_TICKS = 20

const WALL_PX = 4
const DESK_PX = 10
const BAND_PX = 12
const ALERT_AT = 0.8 // Of the way to Topeka: the room's lights go pink here.
const TOKENS_PER_SHEET = 20000
const MAX_SHEETS = 6
const MAX_BANDS = 3

const FLOOR = 0x221620
const FLOOR_DARK = 0x1a1018
const WALL = 0x3a2030
const WALL_ALERT = [0x5a2048, 0x8a2a68]
const RAIL_AHEAD = 0x56545c
const RAIL_BEHIND = 0xc44a82
const STATION = 0xf5a94a
const SIGN = 0xe8dcc8
const PAPER = 0xe8e0d0
const PAPER_EDGE = 0xb8ae9e
const DUSK = [0x561c20, 0xb04224, 0xf0943c]
const BLAINE = 0xf986b4
const BLAINE_TOP = 0xffc2da
const DESK = 0x6a4632
const DESK_LEG = 0x4a3024
const CHAIR = 0x2c2a33
const LEGS = 0x18141c
const SKIN = 0xe8b48a
const EYE = 0x1a1420
const BEZEL = 0x4a4a55
const SCREEN_OFF = 0x14141c
const ENVELOPE = 0xfff0d8

export const SHIRTS = [0xf986b4, 0x7fb4ff, 0xf5a94a, 0x8fe388, 0xc792ff, 0xff8a6b, 0x5fd6d0, 0xe8e070]
const HAIR = [0x2a1a14, 0x6b3a1e, 0xd8b050, 0x8a2f2f, 0x444450]

export type Seat = { name: string; isWorking: boolean; tokens: number }
export type Flight = { from: number; to: number; at: number }

export const isAlert = (trip: number) => trip >= ALERT_AT

const perRow = (columns: number) => Math.max(1, Math.floor(columns / SLOT))
const capacity = (columns: number) => perRow(columns) * MAX_BANDS

// The room grows a band as agents arrive, so a narrow dock still seats everybody it can.
export function rowsFor(columns: number, seats: number): number {
  const bands = Math.min(MAX_BANDS, Math.max(2, Math.ceil(seats / perRow(columns))))

  return (WALL_PX + bands * BAND_PX) / 2
}

function slot(i: number, columns: number): [number, number] {
  const margin = (columns - perRow(columns) * SLOT) >> 1
  return [margin + (i % perRow(columns)) * SLOT, WALL_PX + Math.floor(i / perRow(columns)) * BAND_PX]
}

// One frame as 0xRRGGBB pixels, row-major. `t` counts ticks; nothing here reads a clock.
// `trip` is how far Blaine has come from Lud to Topeka: context used over the compaction point.
export function paint(w: number, h: number, seats: readonly Seat[], t: number, trip: number, flight?: Flight): Uint32Array {
  const px = new Uint32Array(w * h)
  const rect = (x: number, y: number, rw: number, rh: number, color: number) => {
    for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy += 1) {
      for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx += 1) px[yy * w + xx] = color
    }
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) px[y * w + x] = ((x >> 2) + (y >> 2)) & 1 ? FLOOR : FLOOR_DARK
  }

  // The wall and its dusk windows; the room's lights go pink as Blaine nears Topeka.
  rect(0, 0, w, WALL_PX, isAlert(trip) ? WALL_ALERT[(t >> 2) & 1] : WALL)
  for (let x = 5; x < w - 13; x += 12) {
    rect(x, 0, 7, 1, DUSK[1])
    rect(x, 1, 7, 1, DUSK[2])
  }

  // The rail along the wall: every pixel ridden is context spent, and Topeka is compaction.
  const head = Math.round(Math.min(1, trip) * (w - 2))
  for (let x = 0; x < w; x += 1) px[(WALL_PX - 1) * w + x] = x <= head ? RAIL_BEHIND : RAIL_AHEAD
  rect(w - 1, WALL_PX - 2, 1, 2, STATION)
  rect(head - 6, WALL_PX - 2, 7, 1, BLAINE)
  rect(head - 6, WALL_PX - 2, 5, 1, BLAINE_TOP)
  rect(head - 5, WALL_PX - 1, 6, 1, BLAINE)

  seats.slice(0, capacity(w)).forEach((seat, i) => {
    const [x, y] = slot(i, w)
    const shirt = SHIRTS[i % SHIRTS.length]
    const slump = seat.isWorking ? 0 : 1 // Done agents sag in their chairs.

    rect(x, y + 3, 1, 4, CHAIR)
    rect(x + 1, y + slump, 3, 1, HAIR[i % HAIR.length])
    rect(x + 1, y + 1 + slump, 3, 2, SKIN)
    px[(y + 1 + slump) * w + x + 3] = EYE
    rect(x + 1, y + 3, 3, 3, shirt)
    rect(x + 2, y + 7, 2, 2, LEGS)

    rect(x + 5, y + 1, 5, 4, BEZEL)
    rect(x + 6, y + 2, 3, 2, seat.isWorking ? shirt : SCREEN_OFF)
    if (seat.isWorking) px[(y + 2 + ((t >> 1) & 1)) * w + x + 7] = SCREEN_OFF
    rect(x + 7, y + 5, 1, 1, BEZEL)

    rect(x + 4, y + 4 + (seat.isWorking ? (t >> 1) & 1 : 1), 1, 1, SKIN) // The typing hand.
    rect(x, y + 6, SLOT - 1, 1, DESK)
    rect(x + 1, y + 7, 1, 3, DESK_LEG)
    rect(x + 8, y + 7, 1, 3, DESK_LEG)

    // A paper stack beside the desk: how much this agent has read and written.
    const sheets = Math.min(MAX_SHEETS, Math.ceil(seat.tokens / TOKENS_PER_SHEET))
    for (let k = 0; k < sheets; k += 1) px[(y + DESK_PX - 1 - k) * w + x + 10] = k & 1 ? PAPER_EDGE : PAPER
  })

  if (flight !== undefined && t - flight.at < FLIGHT_TICKS) {
    const [fromX, fromY] = slot(flight.from, w)
    const [toX, toY] = slot(flight.to, w)
    const p = (t - flight.at) / FLIGHT_TICKS
    const x = Math.round(fromX + (toX - fromX) * p) + 4
    const y = Math.round(fromY + (toY - fromY) * p - Math.sin(p * Math.PI) * 3)
    rect(x, y, 3, 2, ENVELOPE)
    rect(x + 1, y, 1, 1, BLAINE)
  }
  return px
}

// `cells` as RasterProps packs them: base64 of [codePoint, foreground, background] per cell.
export function frame(columns: number, rows: number, seats: readonly Seat[], t: number, trip: number, flight?: Flight): string {
  const px = paint(columns, rows * 2, seats, t, trip, flight)
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < columns * rows; i += 1) {
    const top = Math.floor(i / columns) * 2 * columns + (i % columns)
    cells[i * 3] = UPPER_HALF
    cells[i * 3 + 1] = px[top]
    cells[i * 3 + 2] = px[top + columns]
  }

  const sign = (text: string, start: number) => {
    for (let k = 0; k < text.length; k += 1) {
      cells[(start + k) * 3] = text.charCodeAt(k)
      cells[(start + k) * 3 + 1] = SIGN
    }
  }
  sign('LUD', 0)
  sign('TOPEKA', columns - 6)

  seats.slice(0, capacity(columns)).forEach((seat, i) => {
    const [x, y] = slot(i, columns)
    const row = (y + DESK_PX) >> 1
    if (row >= rows) return
    // A cell takes one printable width-1 character, so anything wider becomes a dot.
    const label = seat.name.replace(/[^\x20-\x7e]/g, '.').slice(0, SLOT - 1)
    const start = x + ((SLOT - label.length) >> 1)
    for (let k = 0; k < label.length; k += 1) {
      const at = (row * columns + start + k) * 3
      cells[at] = label.charCodeAt(k)
      cells[at + 1] = SHIRTS[i % SHIRTS.length]
      cells[at + 2] = FLOOR_DARK
    }
  })
  return new Uint8Array(cells.buffer).toBase64()
}
