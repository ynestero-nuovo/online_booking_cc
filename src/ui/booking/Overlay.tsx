"use client";

import type { ReactNode } from "react";

/** Повноекранна шторка з фірмовою шапкою (кнопка назад + заголовок). */
export default function Overlay({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      <header
        className="flex items-center gap-3 bg-brand px-4 pb-3 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.85rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none active:bg-white/15"
        >
          ‹
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-sm text-white/80">{subtitle}</p>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

      {footer && (
        <div
          className="border-t border-zinc-100 bg-white px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 15px)" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
