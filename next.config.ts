import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Дозволяємо доступ до dev-ресурсів (HMR) з телефону в локальній мережі.
  allowedDevOrigins: ["172.28.16.1"],
};

export default nextConfig;
