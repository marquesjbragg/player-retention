import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import QueryProvider from '@/providers/QueryProvider'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Player Retention',
  description: 'College basketball player retention and continuity analytics',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Runs before hydration to avoid flash of wrong theme */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}})()` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <Navbar />
          <main>{children}</main>
        </QueryProvider>
      </body>
    </html>
  )
}
