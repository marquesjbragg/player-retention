import type { Metadata } from 'next'
import PlayerBrowsePage from '@/components/browse/PlayerBrowsePage'

export const metadata: Metadata = { title: 'Players · Player Retention' }

export default function PlayersPage() {
  return <PlayerBrowsePage />
}
