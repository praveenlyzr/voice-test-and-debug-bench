/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: Don't use 'standalone' output with Amplify - it breaks env var injection for SSR
}

module.exports = nextConfig
