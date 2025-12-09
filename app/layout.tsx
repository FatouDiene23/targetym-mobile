import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Targetym AI - Dashboard",
  description: "Tableau de bord RH intelligent - Targetym AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
