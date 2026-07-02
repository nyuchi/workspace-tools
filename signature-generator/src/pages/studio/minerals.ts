import type { Category } from '../../engines/nyuchi'

export interface MineralPreset {
  idx: string
  role: string
  desc: string
  origin: string
}

/* Editorial copy shown when the user clicks "Load this mineral's copy".
   Mirrors the source studio's MINERALS record. */
export const MINERALS: Record<Category, MineralPreset> = {
  cobalt:     { idx: '01', role: 'Knowledge',    desc: 'The mineral in every battery on earth. Our blue of learning and trust.',                              origin: 'Katanga Copperbelt · DRC & Zambia' },
  sodalite:   { idx: '02', role: 'Intelligence', desc: "Cobalt's deeper cousin — the colour of a mind reasoning through a hard problem.",                      origin: 'Kunene River · Namibia & South Africa' },
  tanzanite:  { idx: '03', role: 'Identity',     desc: 'A thousand times rarer than diamond, found on a single hillside on earth.',                            origin: 'Merelani Hills · Tanzania' },
  malachite:  { idx: '04', role: 'Growth',       desc: 'The oldest green in the human story. The signal that something is alive and working.',                 origin: 'Congo Copper Belt' },
  gold:       { idx: '05', role: 'Value',        desc: 'The metal and the honey. nyuchi means bee — the reward carried home to the hive.',                     origin: 'Ghana · South Africa · Mali · Zimbabwe' },
  copper:     { idx: '06', role: 'Stewardship',  desc: 'The metal that connects everything. bundu — the ground the rest are dug from.',                        origin: 'Central African Copperbelt · Zambia & DRC' },
  terracotta: { idx: '07', role: 'Community',    desc: 'Fired clay, the oldest material we build with. Ubuntu — I am because we are.',                          origin: 'Pan-African Sahel' },
}
