import { CARD_TICKS } from './scene'
import type { Palaver } from './scene'

// Roland's spinner verbs: flat and short, set against Blaine's taunts in settings.json.
export const VERBS = [
  'Following',
  'Tracking',
  'Walking the hardpan',
  'Crossing the alkali',
  'Reading the ash',
  'Reading old campfires',
  'Counting footprints',
  'Counting shells',
  'Checking the cylinders',
  'Oiling the guns',
  'Cleaning the barrels',
  'Thumbing the hammer',
  'Sighting down the barrel',
  'Drawing',
  'Holstering',
  'Rationing the water',
  'Wrapping the waterbag',
  'Shading his eyes',
  'Squinting at the sun',
  'Tasting the wind',
  'Reading the wind',
  'Watching the horizon',
  'Following the coach road',
  'Passing a marker stone',
  'Stepping over devil-grass',
  'Banking the fire',
  'Breaking camp',
  'Keeping his own counsel',
  'Saying nothing',
  'Not looking back',
  'Biding',
  'Outlasting the sun',
  'Measuring the shadows',
  'Gaining a step',
  'Closing the distance',
  'Gaining on the man in black',
  'Following the Beam',
  'Walking toward the Tower',
  'Spitting dust',
  'Picking through bones',
  'The trail is still warm',
  'He was here not long ago',
]

// Bobby's verse for the palaver, one line for each part of it.
export const VERSE = [
  'Roland reached the man in black',
  'The campfire burned, the stars looked back',
  'The tokens fell, the cards were cast',
  'And Claude forgot its bloated past',
]

// The engine samples one word a turn; the same word gives the same verb, so the line holds still.
export function verb(word: string) {
  let hash = 0
  for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) >>> 0

  return VERBS[hash % VERBS.length]
}

// A line a card while the summary is written, the last once it is done.
export const verse = (t: number, { at, doneAt }: Palaver) =>
  VERSE[doneAt === undefined ? Math.min(2, Math.max(0, Math.floor((t - at) / CARD_TICKS))) : 3]
