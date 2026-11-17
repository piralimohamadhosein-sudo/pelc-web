import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // خروجی استاتیک برای بسته‌بندی در Capacitor (اندروید)
  output: "export",
  // مسیر پایهٔ خالی تا فایل‌ها از root وب‌ویو load شوند
  basePath: "",
  assetPrefix: "./",
  // بدون تولید تصاویر دینامیک در حالت استاتیک
  images: {
    unoptimized: true,
  },
  // صفحهٔ ۴۰۴ ثابت
  trailingSlash: true,
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
