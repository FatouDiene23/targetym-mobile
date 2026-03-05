import './globals.css'
import ToastProvider from '@/components/ToastProvider'

export const metadata = {
  title: 'Targetym AI - Dashboard',
  description: 'Plateforme RH intelligente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}