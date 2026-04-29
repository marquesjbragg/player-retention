import type { Metadata } from 'next'
import BrowsePage from '@/components/browse/BrowsePage'

export const metadata: Metadata = { title: 'Browse · Player Retention' }

export default function Browse() {
  return <BrowsePage />
}
