/** @type {import('next').NextConfig} */

const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

const nextConfig = {
  // Export statique uniquement pour Capacitor (mobile)
  ...(isMobileBuild && {
    output: 'export',
    trailingSlash: true,
  }),

  images: {
    unoptimized: isMobileBuild,
  },

  // Ignorer les erreurs TypeScript pour éviter crash mémoire au build mobile
  ...(isMobileBuild && {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
  }),
};

export default nextConfig;
