/** @type {import('next').NextConfig} */

const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

const nextConfig = {
  // Export statique uniquement pour Capacitor (mobile)
  // Pour le web (Vercel), on garde le mode normal
  ...(isMobileBuild && {
    output: 'export',
    trailingSlash: true,
  }),

  images: {
    // Désactiver l'optimisation uniquement en mobile (non compatible avec export statique)
    unoptimized: isMobileBuild,
  },
};

export default nextConfig;
