import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'نظام إدارة المأموريات | وزارة الصحة',
  description: 'لوحة التحكم لنظام إدارة المأموريات الميدانية',
  icons: {
    icon: '/mohp-logo.png',
    shortcut: '/favicon.ico',
    apple: '/mohp-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
