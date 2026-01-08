import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiveKit Call Trigger',
  description: 'Simple interface to trigger outbound calls via LiveKit',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="text-lg font-semibold text-indigo-600">LiveKit Control</div>
            <nav className="flex gap-4 text-sm font-medium text-slate-700">
              <a href="/websession" className="hover:text-indigo-600">Web Session</a>
              <a href="/outbound" className="hover:text-indigo-600">Outbound</a>
              <a href="/inbound" className="hover:text-indigo-600">Inbound</a>
              <a href="/configs" className="hover:text-indigo-600">Configs</a>
              <a href="/logs" className="hover:text-indigo-600">Logs</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
