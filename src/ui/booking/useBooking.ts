"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking, Category, Service, Slot } from "@/domain/types";
import { commonSpecialistIds as computeCommonSpecialistIds } from "@/domain/availability";
import { addDaysIso, todayIsoDate } from "@/lib/date";
import { createBooking, fetchAvailability, fetchServices, fetchSpecialists } from "./api";
import type { AvailabilityResponse, SpecialistWithAvailability } from "./api";
import { formatDateShort, formatTime } from "./format";
import { kyivDate } from "@/lib/timezone";

export type Screen =
  | "home"
  | "specialist"
  | "services"
  | "datetime"
  | "confirm"
  | "about"
  | "success";

const HORIZON_DAYS = 60;

/** UUID із фолбеком: crypto.randomUUID доступний лише в secure context (HTTPS/localhost). */
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bk-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Уся логіка флоу запису: стан вибору, завантаження даних, похідні значення й
 * переходи. `BookingFlow` лишається презентаційним — лише рендерить екрани за
 * `screen` та цим станом.
 */
export function useBooking() {
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
  const [freeAtLoading, setFreeAtLoading] = useState(false);
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
  const commonSpecialistIds = useMemo(
    () => computeCommonSpecialistIds(selectedServices),
    [selectedServices],
  );

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

  // Підпис обіцяє фільтр «вільні на час» лише коли його реально застосовано (freeAtSlotIds).
  const specialistFilterNote =
    slot && freeAtSlotIds
      ? `Вільні на ${formatDateShort(kyivDate(slot.startTime))} о ${formatTime(slot.startTime)}`
      : selectedServices.length > 0
        ? "Виконують обрані послуги"
        : undefined;

  // Хто вільний на обраний час: окремий запит на дату слота без дедуплікації.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slot || selectedServices.length === 0) {
        if (!cancelled) {
          setFreeAtSlotIds(null);
          setFreeAtLoading(false);
        }
        return;
      }
      setFreeAtLoading(true);
      const date = kyivDate(slot.startTime);
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
      } finally {
        if (!cancelled) setFreeAtLoading(false);
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
        const from = todayIsoDate();
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
    setSlot(null); // слот прив'язаний до лікаря — скидаємо разом, щоб не лишити чужого
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

  return {
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
  };
}
