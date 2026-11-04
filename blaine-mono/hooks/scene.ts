// The waste lands as a pixel grid. A terminal cell shows two pixels: an upper-half
// block's foreground on top, its background below, which makes the pixels square.
const UPPER_HALF = 0x2580
const TILE = 512 // Terrain repeats every TILE columns.
const PYLON_GAP = 28
const BODY_ROWS = 6

export const MIN_ROWS = BODY_ROWS // The rail needs six pixels below it, the train six above.
export const FAST = 3 // Foreground pixels per tick; slower layers are fractions of it.
const ALERT_AT = 0.8 // Of the way to Topeka: Blaine's windows go pink here.
export const BLAST_TICKS = 45 // Three seconds at fifteen frames a second.
export const STILL_AGE = 14 // The one frame of a blast that reduced motion holds.
const TRAIN_LASTS = 6 // Ticks into a blast before the train is gone.
const BURSTS = 7

// Context as a trip: tokens in the window now, and Topeka, the end of the window.
export type Reading = { tokens: number; topeka: number }

// What the account says besides the context: the session's cost in dollars, how much of the
// 5 hour limit is spent, and the minutes until it resets.
export type World = { cost?: number; limit?: number; resetMin?: number }

// Blaine blowing up: ticks since it began, and how far along the line he got.
export type Blast = { age: number; trip: number }

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
export const FIRE = [0xfff6d0, 0xffd24a, 0xf6842c, 0xc43a1e, 0x4a2a30] // Hot to cold, then smoke.
const BUFFER = 0xb0303a // Topeka's buffer stop, striped with SIGN.
const MAP_LINE = 0x5a4656
const LITTLE = 0x8fb4e0 // Little Blaine's whisper.

// Topeka after the crash: hazy daylight, a station and its clock tower, a highway sign, the ka-tet.
const HAZE = [0x8f959c, 0x9ea1a2, 0xadada7, 0xbcb8ab, 0xcac2ad, 0xd5c9af, 0xdecfb1, 0xe6d5b4]
const DIRT = 0x9a8e78
const DIRT_DARK = 0x8d816c
const STATION = 0x6e5546
const STATION_DARK = 0x4a3830
const STATION_WINDOW = 0x2c2420
const CLOCK = 0xf0ead8
const SCORCH = 0x3a2026
const SMOKE = [0x5c5856, 0x7a7672, 0x96928c]
const ROAD_SIGN = 0x1f7a3c
const INK = 0x241812 // Letters on a bright sky.
const KA_TET = [0x8a7a5a, 0x3e4f72, 0x7a3f62, 0x4f6e3e] // Roland, Eddie, Susannah, Jake, by their shirts.
const SKIN = 0xe0b48c
const LEGS = 0x2a2a3a
const OY = 0xcdbb9a

// The riddling, written for this mod: folk riddles and a few for compaction, which Blaine never
// misses, then the one nonsense joke he cannot answer.
const RIDDLES: readonly (readonly [string, string])[] = [
  ['WHAT HAS A NECK BUT NO HEAD?', 'A BOTTLE'],
  ['WHAT HAS TEETH BUT CANNOT BITE?', 'A COMB'],
  ['WHAT GETS WETTER THE MORE IT DRIES?', 'A TOWEL'],
  ['WHAT HAS CITIES BUT NO HOUSES?', 'A MAP'],
  ['WHAT KEEPS THE TALE BUT DROPS THE WORDS?', 'A SUMMARY'],
  ['WHAT HAS AN EYE BUT CANNOT SEE?', 'A NEEDLE'],
  ['WHAT RUNS BUT NEVER WALKS?', 'A RIVER'],
  ['WHAT CAN YOU HOLD WITHOUT TOUCHING?', 'A CONVERSATION'],
  ['THE MORE YOU TAKE, THE MORE YOU LEAVE?', 'FOOTSTEPS'],
  ['WHAT GETS LIGHTER THE MORE IT FORGETS?', 'A CONTEXT WINDOW'],
]
const ASKERS = ['JAKE', 'SUSANNAH', 'EDDIE', 'ROLAND']
const TAUNTS = ['TOO EASY!', 'NEXT!', 'HA! AGAIN!', 'IS THAT ALL?', 'FASTER!']
const WHISPERS = ['keep him talking', 'he means to do it, you know', "i can't stop him"]
const DUCK = ["WHAT'S THE DIFFERENCE BETWEEN A DUCK?", 'ONE OF ITS LEGS IS BOTH THE SAME.']
const BREAKDOWN = [
  'BLAINE: A DUCK IS... A DUCK IS...',
  'BLAINE: B-B-BOTH? BOTH THE SAME?',
  'HA HA HA HA HA HA HA',
  'blaine: why... am i... pink',
]
const STOPS = ['LUD', 'CANDLETON', 'FALLS OF THE HOUNDS', 'DASHERVILLE'] // Then TOPEKA, at the end of the line.
const GLITCH = '#%&@$?!*'
const LINE = 0x2500 // A box-drawing rule for the route map.
const LIGHT = 0x2588 // Blaine's blinking place on it.

// A riddle about every four seconds while the summary is written; Blaine answers a beat and a half in.
export const RIDDLE_TICKS = 60
const ANSWER_AT = 24
const READ_TICKS = 14 // His last answer stays up this long before Eddie cuts in.
const DUCK_TICKS = 30
const FRANTIC_TICKS = 48
const GLIDE_TICKS = 18
const WAKE_TICKS = 75
const ARRIVE_TICKS = 24
export const STILL_RIDDLE = ANSWER_AT + 8 // The riddling frame reduced motion holds: a question and its answer.

// A compaction as the riddling: when it began, where Blaine stood, when the summary came back, and its size.
export type Riddling = { at: number; trip: number; doneAt?: number; before?: number; after?: number }
export type Phase = 'ask' | 'duck' | 'frantic' | 'glide' | 'blast' | 'wake' | 'arrive'
type Mood = { frantic: number; isDark: boolean; burst?: number } // How far gone he is, engines out, the map blowing.

const ACTS: readonly (readonly [Phase, number])[] = [
  ['duck', DUCK_TICKS],
  ['frantic', FRANTIC_TICKS],
  ['glide', GLIDE_TICKS],
  ['blast', BLAST_TICKS],
  ['wake', WAKE_TICKS],
  ['arrive', ARRIVE_TICKS],
]

// Eddie cuts in once the summary is done and Blaine's last answer has been read.
function breakAt({ at, doneAt }: Riddling) {
  if (doneAt === undefined) return Infinity
  const asked = at + Math.floor((doneAt - at) / RIDDLE_TICKS) * RIDDLE_TICKS

  return Math.max(doneAt, asked + ANSWER_AT + READ_TICKS)
}

// Where the riddling is at tick t, or undefined once the next train has left Lud.
export function beat(t: number, riddling: Riddling): { phase: Phase; age: number } | undefined {
  const start = breakAt(riddling)
  if (t < start) return { phase: 'ask', age: t - riddling.at }

  let age = t - start
  for (const [phase, ticks] of ACTS) {
    if (age < ticks) return { phase, age }
    age -= ticks
  }
  return undefined
}

// Each riddle he answers takes him half of the rest of the way: always closer, never there while it runs.
const closing = (trip: number, ticks: number) => 1 - (1 - trip) * 0.5 ** (ticks / RIDDLE_TICKS)

// Where he is on the line and how far the land has scrolled: twice the usual speed while he races,
// slowing to nothing once the engines quit, and still for the blast.
function ride(t: number, riddling: Riddling, phase: Phase, age: number) {
  const glide = breakAt(riddling) + DUCK_TICKS + FRANTIC_TICKS
  const s = Math.min(t, glide) - riddling.at
  const near = closing(riddling.trip, s)

  if (phase === 'glide') {
    const go = riddling.at + 2 * s + 2 * age - (age * age) / GLIDE_TICKS
    return { trip: near + (1 - near) * (1 - (1 - age / GLIDE_TICKS) ** 2), go }
  }
  if (phase === 'blast') return { trip: 1, go: riddling.at + 2 * s + GLIDE_TICKS }
  return { trip: near, go: riddling.at + 2 * s }
}

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

function train(px: Uint32Array, w: number, railY: number, t: number, isMoving: boolean, trip: number, mood?: Mood): void {
  const { length, tail: placed } = span(w, trip)
  // Coming apart, he shakes on the rail, and his hull fades in and out as the visual mode stutters.
  const shake = mood !== undefined && noise(t, 13) < mood.frantic ? (t & 1) * 2 - 1 : 0
  const tail = Math.max(0, Math.min(w - 1 - length, placed + shake))
  const nose = tail + length
  const fade = mood === undefined ? 0 : mood.frantic * (0.5 + 0.5 * Math.sin(t * 0.8)) * 0.85

  for (let r = 0; r < BODY_ROWS; r += 1) {
    const y = railY - BODY_ROWS + r
    for (let x = tail + TAIL_TAPER[r]; x <= nose - NOSE_TAPER[r]; x += 1) {
      if (BAYER[(y & 3) * 4 + (x & 3)] / 16 >= fade) px[y * w + x] = BODY[r]
    }
  }

  const windowY = railY - BODY_ROWS + WINDOW_ROW
  for (let x = tail + 5, n = 0; x < nose - 17; x += 7, n += 1) {
    const lit = isAlert(trip) ? WINDOW_PINK : noise(n, 7) < 0.3 ? WINDOW_DIM : WINDOW
    const isOut = mood !== undefined && (mood.isDark || noise(n, t) < mood.frantic * 0.7)
    px.fill(isOut ? EYE : lit, windowY * w + x, windowY * w + x + 5)
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

// He goes up nose first, the fire runs back along him, and pink pieces fly and fall.
function explosion(px: Uint32Array, w: number, h: number, railY: number, trip: number, age: number): void {
  const { length, nose } = span(w, trip)

  for (let n = 0; n < BURSTS; n += 1) {
    const life = age - n * 2
    if (life <= 0) continue

    const cx = nose - Math.round((n / (BURSTS - 1)) * length)
    const cy = railY - 3 - Math.floor(noise(n, 8) * 5)
    const radius = (6 + noise(n, 9) * 5) * Math.min(1, life / 7)
    const fade = (life - 14) / 18

    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(h - 1, Math.ceil(cy + radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(w - 1, Math.ceil(cx + radius)); x += 1) {
        const reach = Math.hypot(x - cx, y - cy) / radius
        if (reach > 1 || BAYER[(y & 3) * 4 + (x & 3)] / 16 < fade) continue

        px[y * w + x] = FIRE[Math.min(FIRE.length - 1, Math.floor(reach * 3 + life / 8))]
      }
    }
  }

  for (let i = 0; i < 36; i += 1) {
    const x = Math.round(nose - noise(i, 10) * length + (noise(i, 11) - 0.5) * age * 1.6)
    const y = Math.round(railY - 3 - (0.2 + noise(i, 12) * 1.1) * age + 0.04 * age * age)
    if (x >= 0 && x < w && y >= 0 && y < railY) px[y * w + x] = BODY[i % BODY.length]
  }
}

// Topeka's buffer stop at the very end of the line.
function buffer(px: Uint32Array, w: number, railY: number) {
  for (let y = railY - 4; y <= railY; y += 1) px.fill(y & 1 ? BUFFER : SIGN, y * w + w - 3, y * w + w)
}

// The route map blowing apart: sparks along the top of the band, falling and going out.
function burst(px: Uint32Array, w: number, h: number, age: number) {
  for (let i = 0; i < 48; i += 1) {
    if (noise(i, 16) < age / GLIDE_TICKS) continue

    const x = Math.floor(noise(i, 14) * w)
    const y = Math.floor(noise(i, 15) * 2 + age * (0.2 + noise(i, 17) * 0.4))
    if (y < h) px[y * w + x] = noise(i, 18) < 0.5 ? SPARK : FIRE[1]
  }
}

// One of the ka-tet, a pixel wide with legs that scissor as they walk; Oy is low and long.
function person(px: Uint32Array, w: number, h: number, x: number, feet: number, who: number, step: number) {
  const put = (dx: number, y: number, color: number) => {
    if (x + dx >= 0 && x + dx < w && y >= 0 && y < h) px[y * w + x + dx] = color
  }

  if (who === KA_TET.length) {
    put(0, feet, OY)
    put(1, feet, OY)
    put(-1, feet - 1, OY)
    put(0, feet - 1, OY)
    put(1, feet - 1, OY)
    put(2, feet - 2, OY)
    return
  }

  const tall = who === 3 ? 3 : 4 // Jake is a head shorter.
  put(0, feet - tall + 1, SKIN)
  for (let y = feet - tall + 2; y < feet; y += 1) put(0, y, KA_TET[who])
  if ((step >> 2) & 1) {
    put(-1, feet, LEGS)
    put(1, feet, LEGS)
  } else {
    put(0, feet, LEGS)
  }
}

// Where the Topeka scene puts its station, the station's clock tower, and the highway sign.
function landmarks(w: number) {
  const station = Math.max(Math.floor(w * 0.6), w - 34)

  return { station, tower: station + 5, sign: Math.floor(w * 0.16) }
}

// After the crash: hazy daylight over an empty Topeka, the wreck smoking at the end of the line,
// and the ka-tet climbing out of a hatch and walking off past the highway sign.
function endOfLine(w: number, h: number, rows: number, age: number): Uint32Array {
  const px = new Uint32Array(w * h)
  const horizon = h - 4
  const railY = h - 6
  const roof = Math.max(1, horizon - 10) // Two rows of station show over the wreck, and a short band keeps a roof.
  const { station, tower, sign } = landmarks(w)

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color: number
      if (y >= horizon) {
        color = noise(x, y) < 0.08 ? DIRT_DARK : DIRT
      } else {
        const shade = (y / horizon) * (HAZE.length - 1) + BAYER[(y & 3) * 4 + (x & 3)] / 16
        color = HAZE[Math.min(HAZE.length - 1, Math.floor(shade))]
        if (x >= station && y >= roof) {
          color = y === roof ? STATION_DARK : (y - roof) % 3 === 1 && x % 3 === 1 ? STATION_WINDOW : STATION
        }
        if (x >= tower && x < tower + 6 && y >= 1 && y < roof) {
          color = y >= 2 && y <= 3 && x > tower && x < tower + 5 ? CLOCK : STATION_DARK
        }
      }

      const rail = x % PYLON_GAP
      if (y > railY && rail < 2) color = rail === 0 ? PYLON_LIT : PYLON
      if (y === railY) color = RAIL
      if (y === railY + 1) color = x % 4 === 0 ? RAIL_TICK : RAIL_UNDER
      px[y * w + x] = color
    }
  }

  // A green highway sign on a post; frame() writes its number.
  if (rows >= 8) {
    const top = 2 * (rows - 5) - 1
    for (let y = top; y <= top + 3; y += 1) px.fill(ROAD_SIGN, y * w + sign, y * w + sign + 4)
    for (let y = top + 4; y < h; y += 1) px[y * w + sign + 1] = PYLON
  }

  // The wreck, dark and scorched at the nose, with smoke going up from it.
  train(px, w, railY, 0, false, 1, { frantic: 0, isDark: true })
  const { length, tail, nose } = span(w, 1)
  for (let y = railY - BODY_ROWS; y < railY; y += 1) {
    for (let x = nose - Math.floor(length / 3); x <= nose; x += 1) {
      if (BODY.includes(px[y * w + x]) && BAYER[(y & 3) * 4 + (x & 3)] < 13) px[y * w + x] = SCORCH
    }
  }
  for (let i = 0; i < 24; i += 1) {
    const rise = (age * 0.5 + i * 3) % 14
    const x = Math.round(nose - 6 + Math.sin(i * 1.7 + age * 0.1) * 2 + rise * 0.3)
    const y = Math.round(railY - BODY_ROWS - 1 - rise)
    if (x >= 0 && x + 1 < w && y >= 0) {
      px[y * w + x] = SMOKE[i % SMOKE.length]
      px[y * w + x + 1] = SMOKE[(i + 1) % SMOKE.length]
    }
  }

  // Out of the hatch one at a time, along his roof, down past his tail, and off toward the highway.
  const hatch = tail + Math.floor(length * 0.55)
  for (let who = 0; who <= KA_TET.length; who += 1) {
    const out = age - 12 - who * 9
    if (out < 0) continue

    const x = Math.round(hatch - out * 0.6)
    person(px, w, h, x, x >= tail + 2 ? railY - BODY_ROWS - 1 : h - 1, who, out)
  }
  return px
}

// One frame as 0xRRGGBB pixels, row-major. `t` counts ticks; the scene never reads a clock.
export function paint(
  w: number,
  h: number,
  t: number,
  isMoving: boolean,
  trip = 0,
  blastAge?: number,
  mood?: Mood,
): Uint32Array {
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

  if (blastAge === undefined || blastAge < TRAIN_LASTS) train(px, w, railY, t, isMoving, trip, mood)
  if (mood !== undefined) buffer(px, w, railY)
  if (blastAge !== undefined) explosion(px, w, h, railY, trip, blastAge)
  if (mood?.burst !== undefined) burst(px, w, h, mood.burst)

  if (isMoving) {
    for (let x = 0; x < w; x += 1) {
      if (noise(x, t) < 0.012) px[(railY + 1) * w + x] = SPARK
    }
  }
  return px
}

// `cells` as RasterProps packs them: base64 of [codePoint, foreground, background] per cell.
// Letters sit in their own cells: LUD and TOPEKA on the top row, the token count over the train.
export function frame(
  columns: number,
  rows: number,
  t: number,
  isMoving: boolean,
  reading?: Reading,
  blast?: Blast,
  riddling?: Riddling,
  world: World = {},
): string {
  const act = riddling && beat(t, riddling)
  if (riddling !== undefined && act !== undefined && act.phase !== 'arrive') {
    return riddle(columns, rows, t, reading, riddling, act.phase, act.age)
  }

  // The next train leaves Lud and runs out to where the new count puts him.
  const trip = act ? tripOf(reading) * (1 - (1 - act.age / ARRIVE_TICKS) ** 2) : (blast?.trip ?? tripOf(reading))
  const cells = pack(paint(columns, rows * 2, t, isMoving, trip, blast?.age), columns, rows)
  const write = writer(cells, columns, rows, t)
  const color = isAlert(trip) ? WINDOW_PINK : SIGN
  const topeka = sign(reading)
  write('LUD', 0, 0, color)

  // The cost, the limit and when it resets, between the two ends of the line.
  const minutes = world.resetMin === undefined ? '' : world.resetMin >= 60 ? `${Math.floor(world.resetMin / 60)}h${String(Math.round(world.resetMin % 60)).padStart(2, '0')}m` : `${Math.max(0, Math.round(world.resetMin))}m`
  const spent = [
    world.cost === undefined ? '' : `$${world.cost.toFixed(world.cost < 100 ? 2 : 0)}`,
    world.limit === undefined ? '' : `5H ${Math.round(world.limit)}%`,
    world.limit === undefined ? '' : minutes,
  ]
    .filter(Boolean)
    .join(' ')
  if (spent !== '' && 4 + spent.length + 2 + topeka.length <= columns) write(spent, 0, 4, (world.limit ?? 0) >= ALERT_AT * 100 ? WINDOW_PINK : SIGN)
  write(topeka, 0, columns - topeka.length, color)

  const labelRow = rows - BODY_ROWS - 1 // The cell row just above the train's roof.
  if (reading !== undefined && blast === undefined && labelRow >= 1) {
    const { length, tail } = span(columns, trip)
    const label = short(reading.tokens)
    write(label, labelRow, Math.max(0, Math.min(columns - label.length, tail + ((length - label.length) >> 1))), color)
  }
  return new Uint8Array(cells.buffer).toBase64()
}

const sign = (reading?: Reading) => (reading === undefined ? 'TOPEKA' : `TOPEKA ${short(reading.topeka)}`)

function pack(px: Uint32Array, columns: number, rows: number) {
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < columns * rows; i += 1) {
    const top = Math.floor(i / columns) * 2 * columns + (i % columns)
    cells[i * 3] = UPPER_HALF
    cells[i * 3 + 1] = px[top]
    cells[i * 3 + 2] = px[top + columns]
  }
  return cells
}

// Letters into their own cells, clipped to the band; `garble` is the chance each one comes out as junk.
function writer(cells: Uint32Array, columns: number, rows: number, t: number) {
  return (text: string, row: number, start: number, color: number, garble = 0) => {
    if (row < 0 || row >= rows) return

    for (let k = 0; k < text.length; k += 1) {
      const col = start + k
      if (col < 0 || col >= columns) continue

      let code = text.charCodeAt(k)
      if (garble > 0 && code !== 32 && noise(col * 31 + row, t) < garble) {
        code = GLITCH.charCodeAt(Math.floor(noise(col, t + 7) * GLITCH.length))
      }
      cells[(row * columns + col) * 3] = code
      cells[(row * columns + col) * 3 + 1] = color
    }
  }
}

// The top row as Blaine's route map: the line, the stops that fit, and his blinking place on it.
function routeMap(write: ReturnType<typeof writer>, columns: number, trip: number, t: number, last: string, garble: number) {
  write(String.fromCharCode(LINE).repeat(columns), 0, 0, MAP_LINE)
  const end = columns - last.length
  let free = 0
  for (const [i, stop] of STOPS.entries()) {
    const start = i === 0 ? 0 : Math.round((columns * i) / STOPS.length - stop.length / 2)
    if (start < free || start + stop.length >= end) continue

    write(stop, 0, start, SIGN, garble)
    free = start + stop.length + 2
  }
  write(last, 0, end, SIGN, garble)
  write(String.fromCharCode((t >> 2) & 1 ? LIGHT : LINE), 0, Math.round(trip * (columns - 1)), WINDOW_PINK)
}

// A frame of the riddling, from the first riddle to the wake at Topeka.
function riddle(columns: number, rows: number, t: number, reading: Reading | undefined, riddling: Riddling, phase: Phase, age: number) {
  const labelRow = rows - BODY_ROWS - 1
  const ask = labelRow >= 1 ? 1 : -1 // No room above the roof: the route map alone.
  const answer = labelRow >= 1 ? labelRow : -1 // One row only: the answer takes the question's place.
  const center = (text: string, width = columns) => Math.max(0, (width - text.length) >> 1)

  if (phase === 'wake') {
    const cells = pack(endOfLine(columns, rows * 2, rows, age), columns, rows)
    const write = writer(cells, columns, rows, t)
    const { station, tower, sign: road } = landmarks(columns)
    const caption = 'END OF THE LINE'
    write(caption, Math.max(0, ask), center(caption, station), INK)
    if (riddling.before !== undefined && riddling.after !== undefined && answer > ask) {
      const told = `${short(riddling.before)} DOWN TO ${short(riddling.after)}`
      write(told, answer, center(told, station), INK)
    }
    if (rows >= 9 && tower > center(caption, station) + caption.length) write('4:14', 1, tower + 1, INK)
    if (rows >= 8) write('70', rows - 5, road + 1, SIGN)
    return new Uint8Array(cells.buffer).toBase64()
  }

  const { trip, go } = ride(t, riddling, phase, age)
  const frantic = phase === 'frantic' ? age / FRANTIC_TICKS : 0
  const mood = { frantic, isDark: phase === 'glide' || phase === 'blast', burst: phase === 'glide' ? age : undefined }
  const isRacing = phase === 'ask' || phase === 'duck' || phase === 'frantic'
  const blastAge = phase === 'blast' ? age : undefined
  const cells = pack(paint(columns, rows * 2, Math.floor(go), isRacing, trip, blastAge, mood), columns, rows)
  const write = writer(cells, columns, rows, t)
  const garble = frantic * 0.5
  const say = (text: string, row: number, color: number) => write(text, row, center(text), color, garble)
  const whisper = (text: string) => rows >= 8 && write(`little blaine: ${text}`, rows - 1, 1, LITTLE)

  if (phase === 'blast') {
    write('LUD', 0, 0, SIGN)
    write(sign(reading), 0, columns - sign(reading).length, SIGN)
  } else if (phase !== 'glide') {
    routeMap(write, columns, trip, t, sign(reading), garble) // In the glide the map has blown and all is quiet.
  }

  if (phase === 'ask') {
    const n = Math.floor(age / RIDDLE_TICKS)
    const [question, reply] = RIDDLES[n % RIDDLES.length]
    const isAnswered = age % RIDDLE_TICKS >= ANSWER_AT
    if (!isAnswered || answer > ask) say(`${ASKERS[n % ASKERS.length]}: ${question}`, ask, SIGN)
    if (isAnswered) say(`BLAINE: ${reply}. ${TAUNTS[n % TAUNTS.length]}`, answer, WINDOW_PINK)
    if (n % 3 === 1 && age % RIDDLE_TICKS >= 8) whisper(WHISPERS[Math.floor(n / 3) % WHISPERS.length])
  } else if (phase === 'duck') {
    const isAnswering = age >= 14
    if (!isAnswering || answer > ask) say(`EDDIE: ${DUCK[0]}`, ask, SIGN)
    if (isAnswering) say(`BLAINE: ${'.'.repeat(1 + ((age - 14) >> 2))}`, answer, WINDOW_PINK)
  } else if (phase === 'frantic') {
    const part = Math.min(BREAKDOWN.length - 1, Math.floor((age * BREAKDOWN.length) / FRANTIC_TICKS))
    if (answer > ask) say(`EDDIE: ${DUCK[1]}`, ask, SIGN)
    // His own words break up less, and the last, small one comes through whole.
    const words = BREAKDOWN[part]
    write(words, answer, center(words), WINDOW_PINK, part === BREAKDOWN.length - 1 ? 0 : garble / 2)
    if (part === 2 && ask >= 0) {
      for (let i = 0; i < 6; i += 1) {
        write('HA', ask + (i & 1) * (answer - ask), Math.floor(noise(i, t >> 1) * (columns - 2)), WINDOW_PINK)
      }
    }
    whisper('hold on to something!')
  }
  return new Uint8Array(cells.buffer).toBase64()
}
