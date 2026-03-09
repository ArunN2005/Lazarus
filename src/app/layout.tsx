import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
  weight: '100 900',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Lazarus — Legacy Code Resurrection Engine',
  description:
    'Bring any GitHub repository back to life. Paste a legacy repo URL and watch it get modernized in real-time.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#818cf8',
          colorBackground: '#070e1e',
          colorInputBackground: '#030712',
          colorText: '#e8eeff',
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-bg-base text-text-primary`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
