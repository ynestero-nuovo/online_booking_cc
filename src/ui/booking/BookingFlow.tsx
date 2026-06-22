"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Booking, Category, Service, Slot } from "@/domain/types";
import { SALON } from "@/lib/salon";
import {
  AvailabilityResponse,
  createBooking,
  fetchAvailability,
  fetchServices,
  fetchSpecialists,
  SpecialistWithAvailability,
} from "./api";
import { formatDateShort, formatDuration, formatPrice, formatTime } from "./format";
import Overlay from "./Overlay";
import Avatar from "./Avatar";
import SpecialistScreen from "./SpecialistScreen";
import ServiceScreen from "./ServiceScreen";
import DateTimeScreen from "./DateTimeScreen";
import ConfirmScreen from "./ConfirmScreen";

type Screen = "home" | "specialist" | "services" | "datetime" | "confirm" | "about" | "success";

const HORIZON_DAYS = 60;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
/** UUID із фолбеком: crypto.randomUUID доступний лише в secure context (HTTPS/localhost). */
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bk-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export default function BookingFlow() {
  const [screen, setScreen] = useState<Screen>("home");

  const [specialists, setSpecialists] = useState<SpecialistWithAvailability[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[] | null>(null);

  // Вибір користувача.
  const [anyChosen, setAnyChosen] = useState(false);
  const [specialist, setSpecialist] = useState<SpecialistWithAvailability | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState<Slot | null>(null);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  // Спеціалісти, вільні на обраний час (slot) — для фільтра екрана спеціалістів.
  const [freeAtSlotIds, setFreeAtSlotIds] = useState<string[] | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    fetchSpecialists().then(setSpecialists).catch((e) => setError(e.message));
    fetchServices()
      .then((r) => {
        setCategories(r.categories);
        setServices(r.services);
      })
      .catch((e) => setError(e.message));
  }, []);

  const selectedServices = useMemo(
    () => (services ?? []).filter((s) => selectedIds.has(s.id)),
    [services, selectedIds],
  );
  const totalPrice = selectedServices.reduce((n, s) => n + s.price, 0);
  const totalMin = selectedServices.reduce((n, s) => n + s.durationMin, 0);

  // Спеціалісти, які виконують УСІ обрані послуги (перетин). Якщо порожньо —
  // обрані послуги не можна поєднати в один запис.
  const commonSpecialistIds = useMemo(() => {
    if (selectedServices.length === 0) return [];
    const sets = selectedServices.map((s) => new Set(s.specialistIds));
    return [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
  }, [selectedServices]);

  const blockedReason = useMemo(() => {
    if (selectedServices.length === 0) return null;
    if (commonSpecialistIds.length === 0) {
      return "Ці послуги не виконує один майстер — оформіть їх окремими записами.";
    }
    if (specialist && !commonSpecialistIds.includes(specialist.id)) {
      return `${specialist.name} виконує не всі обрані послуги — оберіть іншого майстра або «Будь-який».`;
    }
    return null;
  }, [selectedServices, commonSpecialistIds, specialist]);

  const specialistChosen = anyChosen || specialist !== null;
  const canSubmit = selectedServices.length > 0 && slot !== null && !blockedReason;

  // Кого показувати на екрані спеціалістів: перетин обмежень —
  // (хто надає всі обрані послуги) ∩ (хто вільний на обраний час).
  const eligibleSpecialistIds = useMemo(() => {
    const constraints: string[][] = [];
    if (selectedServices.length > 0) constraints.push(commonSpecialistIds);
    if (slot && freeAtSlotIds) constraints.push(freeAtSlotIds);
    if (constraints.length === 0) return null;
    return constraints.reduce((acc, c) => acc.filter((id) => c.includes(id)));
  }, [selectedServices, commonSpecialistIds, slot, freeAtSlotIds]);

  const specialistFilterNote = slot
    ? `Вільні на ${formatDateShort(slot.startTime.slice(0, 10))} о ${formatTime(slot.startTime)}`
    : selectedServices.length > 0
      ? "Виконують обрані послуги"
      : undefined;

  // Хто вільний на обраний час: окремий запит на дату слота без дедуплікації.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slot || selectedServices.length === 0) {
        if (!cancelled) setFreeAtSlotIds(null);
        return;
      }
      const date = slot.startTime.slice(0, 10);
      try {
        const r = await fetchAvailability({
          serviceIds: selectedServices.map((s) => s.id),
          from: date,
          to: date,
          dedup: false,
        });
        if (cancelled) return;
        const ids = r.slots.filter((s) => s.startTime === slot.startTime).map((s) => s.specialistId);
        setFreeAtSlotIds([...new Set(ids)]);
      } catch {
        if (!cancelled) setFreeAtSlotIds(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slot, selectedServices]);

  // Завантаження доступності при вході на екран часу.
  useEffect(() => {
    if (screen !== "datetime" || selectedServices.length === 0) return;
    let cancelled = false;
    const load = async () => {
      setLoadingAvail(true);
      setError(null);
      setAvailability(null);
      try {
        const from = todayIso();
        const data = await fetchAvailability({
          serviceIds: selectedServices.map((s) => s.id),
          from,
          to: addDaysIso(from, HORIZON_DAYS),
          specialistId: anyChosen ? undefined : specialist?.id,
        });
        if (!cancelled) setAvailability(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoadingAvail(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [screen, selectedServices, anyChosen, specialist]);

  function chooseSpecialist(s: SpecialistWithAvailability | null) {
    if (s === null) {
      // «Будь-який» — лишаємо обраний час (автопризначений лікар у слоті лишається).
      setAnyChosen(true);
      setSpecialist(null);
      setScreen("home");
      return;
    }
    setAnyChosen(false);
    setSpecialist(s);
    // Прибираємо обрані послуги, яких цей спеціаліст НЕ надає.
    setSelectedIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => services?.find((x) => x.id === id)?.specialistIds.includes(s.id)),
      );
      return next;
    });
    // Лишаємо обраний час, але переприв'язуємо його на цього спеціаліста
    // (його відфільтровано як вільного на цей час).
    setSlot((prev) => (prev ? { ...prev, specialistId: s.id } : prev));
    setScreen("home");
  }
  function clearSpecialist() {
    setAnyChosen(false);
    setSpecialist(null);
    // Час лишаємо — його можна обрати до спеціаліста.
  }
  function toggleService(s: Service) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.add(s.id);
      return next;
    });
    setSlot(null); // зміна послуг скидає час (інша тривалість)
  }
  function removeService(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSlot(null);
  }

  function reset() {
    setScreen("home");
    setAnyChosen(false);
    setSpecialist(null);
    setSelectedIds(new Set());
    setSlot(null);
    setAvailability(null);
    setBooking(null);
    setError(null);
  }

  async function submit(data: { name: string; phone: string; comment: string }) {
    if (!slot || selectedServices.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBooking(
        {
          specialistId: slot.specialistId,
          serviceIds: selectedServices.map((s) => s.id),
          startTime: slot.startTime,
          patient: { name: data.name, phone: data.phone },
          comment: data.comment || undefined,
        },
        idempotencyKey(),
      );
      setBooking(created);
      setScreen("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const slotSpecialistName =
    slot && specialists ? (specialists.find((s) => s.id === slot.specialistId)?.name ?? "") : "";

  // ───────────────────────── Екрани ─────────────────────────

  if (screen === "specialist") {
    return (
      <SpecialistScreen
        specialists={specialists}
        loading={specialists === null}
        eligibleIds={eligibleSpecialistIds}
        filterNote={specialistFilterNote}
        onPick={chooseSpecialist}
        onAny={() => chooseSpecialist(null)}
        onBack={() => setScreen("home")}
      />
    );
  }
  if (screen === "services") {
    return (
      <ServiceScreen
        categories={categories}
        services={services}
        loading={services === null}
        specialist={anyChosen ? null : specialist}
        selectedIds={selectedIds}
        onToggle={toggleService}
        onConfirm={() => setScreen("home")}
        onBack={() => setScreen("home")}
      />
    );
  }
  if (screen === "datetime") {
    return (
      <DateTimeScreen
        slots={availability?.slots ?? []}
        loading={loadingAvail}
        subtitle={`${specialist ? specialist.name : "Будь-який фахівець"} · ${formatDuration(totalMin)}`}
        onPick={(s) => {
          setSlot(s);
          setScreen("home");
        }}
        onBack={() => setScreen("home")}
      />
    );
  }
  if (screen === "confirm" && slot) {
    return (
      <ConfirmScreen
        summary={{
          specialist: slotSpecialistName || (specialist?.name ?? "Будь-який фахівець"),
          services: selectedServices.map((s) => s.name).join(", "),
          when: `${formatDateShort(slot.startTime.slice(0, 10))} о ${formatTime(slot.startTime)}`,
          price: `${formatPrice(totalPrice)} · ${formatDuration(totalMin)}`,
        }}
        loading={submitting}
        error={error}
        onSubmit={submit}
        onBack={() => setScreen("home")}
      />
    );
  }
  if (screen === "about") {
    return (
      <Overlay title="Про нас" onBack={() => setScreen("home")}>
        <div className="flex flex-col items-center gap-3 pt-4 text-center text-sm text-zinc-700">
          <Image src="/logo.png" alt="Логотип Nuovo skin" width={96} height={96} className="rounded-full" />
          <p className="text-lg font-semibold text-zinc-900">{SALON.name}</p>
          <p>{SALON.address}</p>
          <p>{SALON.hours}</p>
        </div>
      </Overlay>
    );
  }
  if (screen === "success" && booking) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">Вас записано!</h2>
        <p className="text-sm text-zinc-600">
          {formatDateShort(booking.startTime.slice(0, 10))} о {formatTime(booking.startTime)}
          <br />
          {slotSpecialistName}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 h-12 w-full rounded-xl bg-zinc-100 text-base font-semibold text-zinc-800"
        >
          Новий запис
        </button>
      </div>
    );
  }

  // ───────────────────────── Головний екран (форма) ─────────────────────────

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-white">
      <header
        className="bg-brand px-4 pb-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="Логотип Nuovo skin"
              width={44}
              height={44}
              priority
              className="shrink-0 rounded-full bg-white"
            />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{SALON.name}</p>
              <p className="truncate text-sm text-white/80">{SALON.address}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreen("about")}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm active:bg-white/25"
          >
            Про нас
          </button>
        </div>
      </header>

      <main className="pb-safe flex-1 px-4 py-5">
        <h1 className="mb-5 text-xl font-semibold text-zinc-900">
          Заплануйте візит на зручний час
        </h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Фахівець */}
        <FieldLabel>Фахівець</FieldLabel>
        <FieldButton onClick={() => setScreen("specialist")} onClear={specialistChosen ? clearSpecialist : undefined}>
          {specialist ? (
            <span className="flex items-center gap-3">
              <Avatar name={specialist.name} photoUrl={specialist.photoUrl} size={40} />
              <span className="flex flex-col text-left">
                <span className="font-medium text-zinc-900">{specialist.name}</span>
                <span className="text-sm text-zinc-500">{specialist.role}</span>
              </span>
            </span>
          ) : anyChosen ? (
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">★</span>
              <span className="font-medium text-zinc-900">Будь-який фахівець</span>
            </span>
          ) : (
            <span className="text-zinc-400">Оберіть фахівця</span>
          )}
        </FieldButton>

        {/* Послуга */}
        <FieldLabel>Послуга</FieldLabel>
        {selectedServices.length === 0 ? (
          <FieldButton onClick={() => setScreen("services")}>
            <span className="text-zinc-400">Виберіть послугу</span>
          </FieldButton>
        ) : (
          <div className="mb-4 rounded-2xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setScreen("services")}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-semibold text-zinc-900">
                {formatPrice(totalPrice)} <span className="ml-1 font-normal text-zinc-400">{formatDuration(totalMin)}</span>
              </span>
              <span className="text-sm text-brand">Змінити</span>
            </button>
            <ul className="border-t border-zinc-100">
              {selectedServices.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 border-b border-zinc-50 px-4 py-2 text-sm last:border-0">
                  <span className="min-w-0 truncate text-zinc-700">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-zinc-500">{s.price}</span>
                    <button type="button" aria-label="Прибрати" onClick={() => removeService(s.id)} className="text-zinc-400">
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {blockedReason && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{blockedReason}</p>
        )}

        {/* Дата і час */}
        <FieldLabel>Дата і час</FieldLabel>
        <FieldButton
          onClick={() => setScreen("datetime")}
          disabled={selectedServices.length === 0 || !!blockedReason}
          onClear={slot ? () => setSlot(null) : undefined}
        >
          {slot ? (
            <span className="font-medium text-zinc-900">
              {formatDateShort(slot.startTime.slice(0, 10))} о {formatTime(slot.startTime)}
            </span>
          ) : (
            <span className="text-zinc-400">
              {selectedServices.length === 0 ? "Спершу оберіть послугу" : "Виберіть дату і час"}
            </span>
          )}
        </FieldButton>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setScreen("confirm")}
          className="mt-4 w-full rounded-2xl bg-brand py-3.5 text-base font-semibold text-white active:bg-brand-dark disabled:opacity-40"
        >
          Оформити візит
        </button>
      </main>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm text-zinc-500">{children}</p>;
}

function FieldButton({
  children,
  onClick,
  onClear,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center rounded-2xl border border-zinc-200">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex flex-1 items-center px-4 py-3 text-left disabled:opacity-50"
      >
        {children}
      </button>
      {onClear ? (
        <button type="button" aria-label="Очистити" onClick={onClear} className="px-4 text-zinc-400">
          ✕
        </button>
      ) : (
        <span className="px-4 text-zinc-300">›</span>
      )}
    </div>
  );
}
