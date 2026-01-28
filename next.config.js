/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs']
  },
  transpilePackages: ['@uiw/react-md-editor', '@uiw/react-markdown-preview']
}

module.exports = nextConfig
