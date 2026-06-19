"use client";

import { useEffect, useMemo, useState } from "react";
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
function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
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

  const specialistChosen = anyChosen || specialist !== null;
  const canSubmit = selectedServices.length > 0 && slot !== null;

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
    setAnyChosen(s === null);
    setSpecialist(s);
    setSlot(null); // зміна фахівця скидає час
    setScreen("home");
  }
  function clearSpecialist() {
    setAnyChosen(false);
    setSpecialist(null);
    setSlot(null); // лишаємо послуги, скидаємо лише час
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
        crypto.randomUUID(),
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
        <div className="flex flex-col gap-3 text-sm text-zinc-700">
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
      <header className="pt-safe bg-brand px-4 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-semibold">{SALON.name}</p>
            <p className="text-sm text-white/80">{SALON.address}</p>
          </div>
          <button
            type="button"
            onClick={() => setScreen("about")}
            className="rounded-full bg-white/15 px-3 py-1 text-sm active:bg-white/25"
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
              <Avatar name={specialist.name} />
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

        {/* Дата і час */}
        <FieldLabel>Дата і час</FieldLabel>
        <FieldButton
          onClick={() => setScreen("datetime")}
          disabled={selectedServices.length === 0}
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

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
      {initials(name)}
    </span>
  );
}
