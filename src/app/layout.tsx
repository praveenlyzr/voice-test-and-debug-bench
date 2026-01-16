import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiveKit Voice Test Bench',
  description: 'Test interface for LiveKit voice AI calls and sessions',
}

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/numbers', label: 'Numbers' },
  { href: '/web-session', label: 'Web Session' },
  { href: '/outbound', label: 'Outbound' },
  { href: '/live', label: 'Live Calls' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/configs', label: 'Configs' },
  { href: '/logs', label: 'Logs' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" className="text-lg font-semibold text-indigo-600 hover:text-indigo-700">
              LiveKit Test Bench
            </a>
            <nav className="flex flex-wrap gap-1 sm:gap-4 text-sm font-medium text-slate-600">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-2 py-1 rounded-md hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
