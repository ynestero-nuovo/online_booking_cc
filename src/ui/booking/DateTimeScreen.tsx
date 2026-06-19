"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/domain/types";
import Overlay from "./Overlay";
import {
  buildCalendar,
  formatTime,
  groupSlots,
  monthOf,
  slotDate,
  TIME_GROUP_LABEL,
  TIME_GROUP_ORDER,
  WEEKDAYS_SHORT,
} from "./format";

export default function DateTimeScreen({
  slots,
  loading,
  subtitle,
  onPick,
  onBack,
}: {
  slots: Slot[];
  loading: boolean;
  subtitle: string;
  onPick: (slot: Slot) => void;
  onBack: () => void;
}) {
  const enabledDates = useMemo(() => new Set(slots.map(slotDate)), [slots]);
  const sortedDates = useMemo(() => [...enabledDates].sort(), [enabledDates]);
  const firstDate = sortedDates[0] ?? null;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? firstDate;

  const initialMonth = firstDate ? monthOf(firstDate) : monthOf(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState(initialMonth);
  const cal = useMemo(() => buildCalendar(view.year, view.month), [view]);

  // Межі навігації місяцями.
  const minMonth = firstDate ? monthOf(firstDate) : view;
  const lastDate = sortedDates[sortedDates.length - 1];
  const maxMonth = lastDate ? monthOf(lastDate) : view;
  const monthIndex = (m: { year: number; month: number }) => m.year * 12 + m.month;
  const canPrev = monthIndex(view) > monthIndex(minMonth);
  const canNext = monthIndex(view) < monthIndex(maxMonth);

  function shiftMonth(delta: number) {
    const idx = view.year * 12 + view.month + delta;
    setView({ year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 });
  }

  const daySlots = activeDate ? slots.filter((s) => slotDate(s) === activeDate) : [];
  const grouped = groupSlots(daySlots);

  return (
    <Overlay title="Виберіть час" subtitle={subtitle} onBack={onBack}>
      {loading && <p className="py-8 text-center text-sm text-zinc-400">Завантаження…</p>}

      {!loading && enabledDates.size === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">Найближчим часом вільних слотів немає.</p>
      )}

      {!loading && enabledDates.size > 0 && (
        <>
          {/* Календар */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => shiftMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-zinc-600 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-medium text-zinc-900">{cal.label}</span>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => shiftMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-zinc-600 disabled:opacity-30"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs text-zinc-400">
              {WEEKDAYS_SHORT.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cal.weeks.flat().map((date, i) => {
                if (!date) return <div key={`e${i}`} />;
                const day = Number(date.slice(8, 10));
                const enabled = enabledDates.has(date);
                const isActive = date === activeDate;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setSelectedDate(date)}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                      isActive
                        ? "bg-brand font-semibold text-white"
                        : enabled
                          ? "text-zinc-900 active:bg-zinc-100"
                          : "text-zinc-300"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Слоти обраного дня */}
          <div className="flex flex-col gap-4">
            {TIME_GROUP_ORDER.map((group) => {
              const list = grouped[group];
              if (list.length === 0) return null;
              return (
                <section key={group}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {TIME_GROUP_LABEL[group]}
                  </h2>
                  <div className="grid grid-cols-4 gap-2">
                    {list.map((s) => (
                      <button
                        key={`${s.specialistId}-${s.startTime}`}
                        type="button"
                        onClick={() => onPick(s)}
                        className="rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-800 active:bg-zinc-100"
                      >
                        {formatTime(s.startTime)}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Overlay>
  );
}
