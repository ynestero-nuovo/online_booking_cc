"use client";

import Overlay from "./Overlay";
import Avatar from "./Avatar";
import type { SpecialistWithAvailability } from "./api";
import { formatDateLong } from "./format";

export default function SpecialistScreen({
  specialists,
  loading,
  eligibleIds,
  filterNote,
  onPick,
  onAny,
  onBack,
}: {
  specialists: SpecialistWithAvailability[] | null;
  loading: boolean;
  /** Якщо задано — показуємо лише цих спеціалістів (за послугами/часом). null — усіх. */
  eligibleIds: string[] | null;
  /** Підпис, що пояснює фільтр (напр. «вільні на обраний час»). */
  filterNote?: string;
  onPick: (s: SpecialistWithAvailability) => void;
  onAny: () => void;
  onBack: () => void;
}) {
  const visible = eligibleIds
    ? (specialists ?? []).filter((s) => eligibleIds.includes(s.id))
    : (specialists ?? []);
  const showTime = Boolean(eligibleIds); // фільтр активний → дата зайва (вони вільні на час/доступні)

  return (
    <Overlay title="Оберіть фахівця" subtitle={filterNote} onBack={onBack}>
      <ul className="flex flex-col divide-y divide-zinc-100">
        <li>
          <button
            type="button"
            onClick={onAny}
            className="flex w-full items-center gap-3 py-3 text-left active:bg-zinc-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              ★
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-zinc-900">Будь-який фахівець</span>
              <span className="text-sm text-zinc-500">
                {eligibleIds ? "Будь-хто з доступних" : "Покажемо всі вільні слоти"}
              </span>
            </span>
          </button>
        </li>

        {loading && !specialists && (
          <li className="py-6 text-center text-sm text-zinc-400">Завантаження…</li>
        )}

        {specialists && visible.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-500">
            Немає доступних майстрів для цього вибору.
          </li>
        )}

        {visible.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="flex w-full items-center gap-3 py-3 text-left active:bg-zinc-50"
            >
              <Avatar name={s.name} photoUrl={s.photoUrl} size={48} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-zinc-900">{s.name}</span>
                <span className="truncate text-sm text-zinc-500">{s.role}</span>
              </span>
              {!showTime && (
                <span className="shrink-0 text-right text-xs text-zinc-400">
                  {s.nearestFreeDate ? (
                    <>
                      <span className="block font-medium text-zinc-700">
                        {formatDateLong(s.nearestFreeDate)}
                      </span>
                      Найближчий вільний день
                    </>
                  ) : (
                    "Немає вільних днів"
                  )}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Overlay>
  );
}
