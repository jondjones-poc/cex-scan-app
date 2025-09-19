/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@sparticuz/chromium", "puppeteer-core");
    }
    return config;
  },
};

export default nextConfig;