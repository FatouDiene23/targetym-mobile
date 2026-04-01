import './globals.css'
import ToastProvider from '@/components/ToastProvider'

export const metadata = {
  title: 'Targetym AI - Dashboard',
  description: 'Plateforme RH intelligente',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
