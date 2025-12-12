import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}