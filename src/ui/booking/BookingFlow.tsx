"use client";

import Image from "next/image";
import { SALON } from "@/lib/salon";
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatPrice,
  formatTime,
} from "./format";
import { kyivDate } from "@/lib/timezone";
import { useBooking } from "./useBooking";
import Avatar from "./Avatar";
import SpecialistScreen from "./SpecialistScreen";
import ServiceScreen from "./ServiceScreen";
import DateTimeScreen from "./DateTimeScreen";
import ConfirmScreen from "./ConfirmScreen";
import AboutScreen from "./AboutScreen";
import SuccessScreen from "./SuccessScreen";

export default function BookingFlow() {
  const {
    screen,
    setScreen,
    specialists,
    categories,
    services,
    anyChosen,
    specialist,
    selectedIds,
    slot,
    setSlot,
    availability,
    freeAtLoading,
    loadingAvail,
    submitting,
    error,
    booking,
    selectedServices,
    totalPrice,
    totalMin,
    blockedReason,
    specialistChosen,
    canSubmit,
    eligibleSpecialistIds,
    specialistFilterNote,
    slotSpecialistName,
    chooseSpecialist,
    clearSpecialist,
    toggleService,
    removeService,
    reset,
    submit,
  } = useBooking();

  // ───────────────────────── Екрани ─────────────────────────

  if (screen === "specialist") {
    return (
      <SpecialistScreen
        specialists={specialists}
        loading={specialists === null || (slot !== null && freeAtLoading)}
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
          when: `${formatDateShort(kyivDate(slot.startTime))} о ${formatTime(slot.startTime)}`,
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
    return <AboutScreen onBack={() => setScreen("home")} />;
  }
  if (screen === "success" && booking) {
    const bookedSpecialist =
      specialists?.find((s) => s.id === booking.specialistId)?.name ?? slotSpecialistName;
    const bookedServices =
      services?.filter((s) => booking.serviceIds.includes(s.id)).map((s) => s.name) ?? [];
    return (
      <SuccessScreen
        specialistName={bookedSpecialist}
        serviceNames={bookedServices}
        dateLabel={formatDateLong(kyivDate(booking.startTime))}
        timeLabel={formatTime(booking.startTime)}
        onReset={reset}
      />
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
              {formatDateShort(kyivDate(slot.startTime))} о {formatTime(slot.startTime)}
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
