/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Endereços antigos continuam funcionando.
  async redirects() {
    return [
      { source: '/transportadoras', destination: '/empresas', permanent: true },
      { source: '/dares', destination: '/historico', permanent: true },
    ]
  },
}

export default nextConfig
