/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.resolve.alias['pg-native'] = false
        return config
    },
}

export default nextConfig
