/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import type { Agenda } from '../agenda'
import { bandTextOf } from './text'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text'>

/**
 * The band's tree for one `ui.render`: one line above the prompt.
 *
 * @param kit Box and Text
 * @param agenda what was last read, or null before the first read lands
 * @param now the moment
 * @returns the tree
 */
export function bandView(kit: Kit, agenda: Agenda | null, now: Date): RenderElement {
  const { Box, Text } = kit

  if (agenda === null) {
    return (
      <Box paddingX={1}>
        <Text dimColor>📅 Reading today…</Text>
      </Box>
    )
  }

  return (
    <Box paddingX={1}>
      <Text wrap="truncate-end">{bandTextOf(agenda, now)}</Text>
    </Box>
  )
}
