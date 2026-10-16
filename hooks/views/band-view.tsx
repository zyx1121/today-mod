/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import type { Agenda } from '../agenda'
import { COLOR, FRAME_CELLS, cellsOf, lineOf, panelOf, type Seg } from './panel'
import { bandSegsOf } from './text'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text'>

/** The panel's title. */
export const TITLE = 'TODAY'

/** The most of the band the panel takes; a longer line is cut. */
export const MAX_SHARE = 0.45

/**
 * The band's panel for one `ui.render`, sized to its line.
 *
 * @param kit Box and Text
 * @param agenda what was last read, or null before the first read lands
 * @param now the moment
 * @param columns the band's body columns
 * @returns the tree
 */
export function bandView(kit: Kit, agenda: Agenda | null, now: Date, columns: number): RenderElement {
  const segs: Seg[] = agenda === null ? [{ text: 'reading today…', color: COLOR.muted }] : bandSegsOf(agenda, now)
  const natural = Math.max(cellsOf(segs), TITLE.length + 2) + FRAME_CELLS
  const width = Math.min(natural, Math.max(TITLE.length + 2 + FRAME_CELLS, Math.floor(columns * MAX_SHARE)))
  const tone = agenda !== null && agenda.errors.length > 0 ? 'error' : 'normal'

  return panelOf(kit, { title: TITLE, tone, width }, lineOf(kit, segs))
}
