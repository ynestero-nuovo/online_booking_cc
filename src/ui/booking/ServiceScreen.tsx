"use client";

import { useMemo, useState } from "react";
import type { Category, Service } from "@/domain/types";
import Overlay from "./Overlay";
import type { SpecialistWithAvailability } from "./api";
import { formatDuration, formatPrice } from "./format";

export default function ServiceScreen({
  categories,
  services,
  loading,
  specialist,
  selectedIds,
  onToggle,
  onConfirm,
  onBack,
}: {
  categories: Category[];
  services: Service[] | null;
  loading: boolean;
  specialist: SpecialistWithAvailability | null;
  selectedIds: Set<string>;
  onToggle: (service: Service) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  // Якщо обрано конкретного фахівця — лише його послуги.
  const visible = useMemo(
    () =>
      (services ?? []).filter((s) => !specialist || s.specialistIds.includes(specialist.id)),
    [services, specialist],
  );

  const visibleCategories = useMemo(
    () => categories.filter((c) => visible.some((s) => s.categoryId === c.id)),
    [categories, visible],
  );

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const currentCat = activeCat ?? visibleCategories[0]?.id ?? null;
  const items = visible.filter((s) => s.categoryId === currentCat);

  const selected = visible.filter((s) => selectedIds.has(s.id));
  const totalPrice = selected.reduce((n, s) => n + s.price, 0);
  const totalMin = selected.reduce((n, s) => n + s.durationMin, 0);

  return (
    <Overlay
      title="Виберіть послугу"
      onBack={onBack}
      footer={
        selected.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Обрані послуги: {selected.length}</span>
              <span className="font-semibold text-zinc-900">
                {formatPrice(totalPrice)} · {formatDuration(totalMin)}
              </span>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="h-12 rounded-xl bg-brand text-base font-semibold text-white active:bg-brand-dark"
            >
              Далі
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-400">Оберіть одну або кілька послуг</p>
        )
      }
    >
      {loading && !services && <p className="text-sm text-zinc-400">Завантаження…</p>}

      {services && (
        <div className="-mx-4 flex">
          {/* Сайдбар категорій */}
          <nav className="w-28 shrink-0 overflow-y-auto border-r border-zinc-100">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={`block w-full px-3 py-2 text-left text-xs leading-tight ${
                  c.id === currentCat
                    ? "border-l-2 border-brand bg-brand/5 font-medium text-brand"
                    : "text-zinc-600"
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>

          {/* Послуги категорії */}
          <ul className="flex-1 px-4">
            {items.map((s) => {
              const checked = selectedIds.has(s.id);
              return (
                <li key={s.id} className="border-b border-zinc-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => onToggle(s)}
                    className="flex w-full items-start gap-3 py-3 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium text-zinc-900">{s.name}</span>
                      <span className="text-xs text-zinc-500">
                        {formatDuration(s.durationMin)} · {formatPrice(s.price)}
                      </span>
                    </span>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                        checked
                          ? "border-brand bg-brand text-white"
                          : "border-zinc-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Overlay>
  );
}
