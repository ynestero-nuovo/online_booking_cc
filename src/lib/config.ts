/**
 * Серверна конфігурація та фабрика провайдера.
 *
 * Читає env, обирає реалізацію BookingProvider. Дефолт — mock. Секрети Cliniccards
 * читаються лише тут (на сервері) і ніколи не потрапляють у клієнтський бандл.
 *
 * ЦЕЙ МОДУЛЬ — ТІЛЬКИ ДЛЯ СЕРВЕРА. Імпортуй його лише з серверних роутів `app/api`.
 */

import { createMockProvider } from "@/integration/mock";
import { createCliniccardsProvider } from "@/integration/cliniccards/provider";
import type { BookingProvider } from "@/integration/ports";

export type ProviderName = "mock" | "cliniccards";

/** Захист: секрети не повинні читатися в браузері. */
if (typeof window !== "undefined") {
  throw new Error("src/lib/config.ts є серверним модулем і не може імпортуватися в клієнті.");
}

interface ServerConfig {
  provider: ProviderName;
  cliniccards: {
    apiKey: string | undefined;
    baseUrl: string | undefined;
  };
}

function readConfig(): ServerConfig {
  const raw = process.env.PROVIDER?.trim().toLowerCase();
  const provider: ProviderName = raw === "cliniccards" ? "cliniccards" : "mock";
  return {
    provider,
    cliniccards: {
      apiKey: process.env.CLINICCARDS_API_KEY,
      baseUrl: process.env.CLINICCARDS_BASE_URL,
    },
  };
}

let cached: BookingProvider | null = null;

/**
 * Повертає сконфігурований BookingProvider (singleton на процес).
 * mock — за замовчуванням; cliniccards — реальний адаптер (підключається в Кроці 9).
 */
export function getProvider(): BookingProvider {
  if (cached) return cached;

  const config = readConfig();

  switch (config.provider) {
    case "cliniccards": {
      const { apiKey, baseUrl } = config.cliniccards;
      if (!apiKey || !baseUrl) {
        throw new Error(
          "PROVIDER=cliniccards потребує CLINICCARDS_API_KEY та CLINICCARDS_BASE_URL у .env.",
        );
      }
      cached = createCliniccardsProvider({ apiKey, baseUrl });
      return cached;
    }
    case "mock":
    default:
      cached = createMockProvider();
      return cached;
  }
}
