"use client";

import Image from "next/image";
import Overlay from "./Overlay";
import { SALON } from "@/lib/salon";

/** Шторка «Про нас»: лого, адреса (Google Maps), години, телефон, соцмережі. */
export default function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <Overlay title="Про нас" onBack={onBack}>
      <div className="flex flex-col items-center gap-4 pt-4 text-center text-sm text-zinc-700">
        <Image src="/logo.png" alt="Логотип Nuovo skin" width={96} height={96} className="rounded-full" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-semibold text-zinc-900">{SALON.name}</p>
          <a
            href={SALON.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2"
          >
            {SALON.address}
          </a>
          <p className="text-zinc-500">{SALON.hours}</p>
        </div>

        <a href={`tel:${SALON.phone}`} className="text-base font-semibold text-zinc-900">
          {SALON.phone}
        </a>

        <div className="flex w-full flex-col gap-2">
          <a
            href={SALON.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 font-medium text-zinc-800 active:bg-zinc-100"
          >
            Instagram
          </a>
          <a
            href={SALON.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 font-medium text-zinc-800 active:bg-zinc-100"
          >
            Telegram
          </a>
        </div>
      </div>
    </Overlay>
  );
}
