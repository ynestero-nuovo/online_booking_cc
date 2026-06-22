import type { NextConfig } from "next";

/** Кеш-заголовок для статичних фото (рідко змінюються): тиждень + SWR місяць. */
const PHOTO_CACHE = "public, max-age=604800, stale-while-revalidate=2592000";

const nextConfig: NextConfig = {
  // Дозволяємо доступ до dev-ресурсів (HMR) з телефону в локальній мережі (лише dev).
  allowedDevOrigins: ["172.28.16.1"],

  // Триваліший кеш оптимізованих next/image (аватари майстрів, лого).
  images: {
    minimumCacheTTL: 604800, // 7 днів
  },

  // Кешуємо ЛИШЕ фото/іконки. API і доступність НЕ кешуємо (запис має бути актуальним).
  async headers() {
    return [
      { source: "/specialists/:path*", headers: [{ key: "Cache-Control", value: PHOTO_CACHE }] },
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: PHOTO_CACHE }] },
      { source: "/logo.png", headers: [{ key: "Cache-Control", value: PHOTO_CACHE }] },
    ];
  },
};

export default nextConfig;
