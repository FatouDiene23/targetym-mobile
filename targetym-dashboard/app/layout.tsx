import './globals.css'
import ToastProvider from '@/components/ToastProvider'
import CapgoUpdater from '@/components/CapgoUpdater'

export const metadata = {
  title: 'Targetym AI - Dashboard',
  description: 'Plateforme RH intelligente',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

// Script qui force la navigation "hard" sur mobile (Capacitor)
// Évite les 404 sur les fichiers RSC (.txt?_rsc) de Next.js 16 en mode export statique
const mobileNavScript = `
(function() {
  if (typeof window === 'undefined') return;

  // Patch: certaines libs appellent Image() sans 'new' → on wrappe le constructeur
  try {
    var _NativeImage = window.Image;
    var ImageWrapper = function(w, h) {
      if (!(this instanceof ImageWrapper)) {
        return new _NativeImage(w, h);
      }
      return new _NativeImage(w, h);
    };
    ImageWrapper.prototype = _NativeImage.prototype;
    window.Image = ImageWrapper;
  } catch (e) {}

  // Détection Capacitor / fichier:// / localhost capacitor
  var isCapacitor = window.location.protocol === 'capacitor:' ||
                    window.location.protocol === 'file:' ||
                    /Android|iPhone|iPad/i.test(navigator.userAgent) && window.location.hostname === 'localhost';
  if (!isCapacitor) return;

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (el.target === '_blank') return;
    e.preventDefault();
    e.stopPropagation();
    // Force full page reload via index.html (export statique Next.js)
    var cleanHref = href.replace(/\/$/, '');
    var target = cleanHref + '/index.html';
    window.location.href = target;
  }, true);
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <script src="/mobile-patch.js" />
        <script dangerouslySetInnerHTML={{ __html: mobileNavScript }} />
      </head>
      <body>
        {children}
        <ToastProvider />
        <CapgoUpdater />
      </body>
    </html>
  )
}
