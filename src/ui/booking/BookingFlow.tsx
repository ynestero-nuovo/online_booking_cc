"use client";

import { useEffect, useState } from "react";
import type { Booking, Category, Service, Slot, Specialist, TimeGroup } from "@/domain/types";
import {
  AvailabilityResponse,
  createBooking,
  fetchAvailability,
  fetchServices,
  fetchSpecialists,
} from "./api";
import { formatDateLabel, formatPrice, formatTime, nextDates } from "./format";

type Step = "specialist" | "service" | "datetime" | "confirm" | "success";

const TIME_GROUP_LABEL: Record<TimeGroup, string> = {
  morning: "Ранок",
  afternoon: "День",
  evening: "Вечір",
};
const TIME_GROUP_ORDER: TimeGroup[] = ["morning", "afternoon", "evening"];

const DATE_COUNT = 7;

export default function BookingFlow() {
  const [step, setStep] = useState<Step>("specialist");

  // Дані довідників.
  const [specialists, setSpecialists] = useState<Specialist[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[] | null>(null);

  // Вибір користувача.
  const [anySpecialist, setAnySpecialist] = useState(false);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string>(() => nextDates(1)[0]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  // Форма підтвердження.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Завантажуємо спеціалістів при старті.
  useEffect(() => {
    fetchSpecialists().then(setSpecialists).catch((e) => setError(e.message));
  }, []);

  // Завантажуємо послуги при вході на крок послуг.
  useEffect(() => {
    if (step !== "service" || services) return;
    fetchServices()
      .then((r) => {
        setCategories(r.categories);
        setServices(r.services);
      })
      .catch((e) => setError(e.message));
  }, [step, services]);

  // Перезавантажуємо доступність при зміні дати/послуги/спеціаліста на кроці часу.
  useEffect(() => {
    if (step !== "datetime" || !service) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setAvailability(null);
      try {
        const data = await fetchAvailability({
          serviceId: service.id,
          date,
          specialistId: anySpecialist ? undefined : specialist?.id,
        });
        if (!cancelled) setAvailability(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [step, service, date, anySpecialist, specialist]);

  function reset() {
    setStep("specialist");
    setAnySpecialist(false);
    setSpecialist(null);
    setService(null);
    setDate(nextDates(1)[0]);
    setAvailability(null);
    setSlot(null);
    setName("");
    setPhone("");
    setComment("");
    setBooking(null);
    setError(null);
  }

  function chooseSpecialist(s: Specialist | null) {
    setError(null);
    setAnySpecialist(s === null);
    setSpecialist(s);
    setService(null);
    setStep("service");
  }

  function chooseService(s: Service) {
    setError(null);
    setService(s);
    setStep("datetime");
  }

  function chooseSlot(s: Slot) {
    setSlot(s);
    setStep("confirm");
  }

  async function submit() {
    if (!service || !slot) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBooking(
        {
          specialistId: slot.specialistId,
          serviceIds: [service.id],
          startTime: slot.startTime,
          patient: { name: name.trim(), phone: phone.trim() },
          comment: comment.trim() || undefined,
        },
        crypto.randomUUID(),
      );
      setBooking(created);
      setStep("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Послуги, доступні для обраного режиму.
  const visibleServices =
    services?.filter(
      (s) => anySpecialist || !specialist || s.specialistIds.includes(specialist.id),
    ) ?? [];

  const back: Record<Step, (() => void) | null> = {
    specialist: null,
    service: () => setStep("specialist"),
    datetime: () => setStep("service"),
    confirm: () => setStep("datetime"),
    success: null,
  };

  const TITLES: Record<Step, string> = {
    specialist: "Оберіть майстра",
    service: "Оберіть послугу",
    datetime: "Оберіть час",
    confirm: "Підтвердження",
    success: "Готово",
  };

  const specialistById = (id: string) => specialists?.find((s) => s.id === id);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-100 bg-white/90 px-4 py-3 backdrop-blur">
        {back[step] ? (
          <button
            type="button"
            onClick={() => back[step]?.()}
            aria-label="Назад"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-xl text-zinc-600 active:bg-zinc-100"
          >
            ‹
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <h1 className="text-lg font-semibold text-zinc-900">{TITLES[step]}</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {step === "specialist" && (
          <ul className="flex flex-col gap-2">
            <li>
              <Card onClick={() => chooseSpecialist(null)} title="Будь-який фахівець" subtitle="Покажемо всі вільні слоти" />
            </li>
            {!specialists && <Skeleton rows={4} />}
            {specialists?.map((s) => (
              <li key={s.id}>
                <Card onClick={() => chooseSpecialist(s)} title={s.alias} subtitle={s.role} />
              </li>
            ))}
          </ul>
        )}

        {step === "service" && (
          <div className="flex flex-col gap-5">
            {!services && <Skeleton rows={5} />}
            {services &&
              categories.map((cat) => {
                const items = visibleServices.filter((s) => s.categoryId === cat.id);
                if (items.length === 0) return null;
                return (
                  <section key={cat.id}>
                    <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-400">
                      {cat.name}
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {items.map((s) => (
                        <li key={s.id}>
                          <Card
                            onClick={() => chooseService(s)}
                            title={s.name}
                            subtitle={`${s.durationMin} хв`}
                            trailing={formatPrice(s.price)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        )}

        {step === "datetime" && (
          <div className="flex flex-col gap-4">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {nextDates(DATE_COUNT).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                    d === date ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {formatDateLabel(d)}
                </button>
              ))}
            </div>

            {loading && <Skeleton rows={3} />}
            {!loading && availability && (
              <SlotGroups availability={availability} onPick={chooseSlot} specialistById={specialistById} showSpecialist={anySpecialist} />
            )}
          </div>
        )}

        {step === "confirm" && service && slot && (
          <div className="flex flex-col gap-5">
            <dl className="rounded-xl bg-zinc-50 p-4 text-sm">
              <Row label="Послуга" value={service.name} />
              <Row label="Майстер" value={specialistById(slot.specialistId)?.alias ?? "—"} />
              <Row label="Дата" value={formatDateLabel(date)} />
              <Row label="Час" value={`${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`} />
              <Row label="Вартість" value={formatPrice(service.price)} />
            </dl>

            <div className="flex flex-col gap-3">
              <Field label="Ім'я" value={name} onChange={setName} placeholder="Як до вас звертатися" />
              <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+380…" type="tel" />
              <Field label="Коментар" value={comment} onChange={setComment} placeholder="Необов'язково" />
            </div>

            <button
              type="button"
              disabled={loading || name.trim().length === 0 || phone.trim().length < 5}
              onClick={submit}
              className="h-12 rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:opacity-40"
            >
              {loading ? "Записуємо…" : "Записатися"}
            </button>
          </div>
        )}

        {step === "success" && booking && (
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
              ✓
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">Вас записано!</h2>
            <p className="text-sm text-zinc-600">
              {formatDateLabel(date)}, {formatTime(booking.startTime)} — {service?.name}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 h-12 w-full rounded-xl bg-zinc-100 text-base font-semibold text-zinc-800"
            >
              Новий запис
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SlotGroups({
  availability,
  onPick,
  specialistById,
  showSpecialist,
}: {
  availability: AvailabilityResponse;
  onPick: (slot: Slot) => void;
  specialistById: (id: string) => Specialist | undefined;
  showSpecialist: boolean;
}) {
  const hasAny = TIME_GROUP_ORDER.some((g) => availability.groups[g].length > 0);
  if (!hasAny) {
    return <p className="py-8 text-center text-sm text-zinc-500">На цей день вільних слотів немає.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {TIME_GROUP_ORDER.map((group) => {
        const slots = availability.groups[group];
        if (slots.length === 0) return null;
        return (
          <section key={group}>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-400">
              {TIME_GROUP_LABEL[group]}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={`${s.specialistId}-${s.startTime}`}
                  type="button"
                  onClick={() => onPick(s)}
                  className="flex flex-col items-center rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-800 active:bg-zinc-100"
                >
                  {formatTime(s.startTime)}
                  {showSpecialist && (
                    <span className="text-xs font-normal text-zinc-400">
                      {specialistById(s.specialistId)?.alias}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({
  onClick,
  title,
  subtitle,
  trailing,
}: {
  onClick: () => void;
  title: string;
  subtitle?: string;
  trailing?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left active:bg-zinc-100"
    >
      <span className="flex flex-col">
        <span className="font-medium text-zinc-900">{title}</span>
        {subtitle && <span className="text-sm text-zinc-500">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-sm font-semibold text-zinc-700">{trailing}</span>}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl border border-zinc-200 px-3 text-base outline-none focus:border-zinc-900"
      />
    </label>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
      ))}
    </div>
  );
}
