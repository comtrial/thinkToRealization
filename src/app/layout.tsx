import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from '@/components/providers/Providers'
import '@xterm/xterm/css/xterm.css'
import './globals.css'

const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'ThinkToRealization',
  description: '캔버스 기반 개발 사고 운영 도구',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TTR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
