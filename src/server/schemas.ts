/**
 * Zod-схеми валідації вхідних даних BFF-роутів.
 */

import { z } from "zod";
import { digitsOnly } from "@/lib/phone";

/** ISO-дата "YYYY-MM-DD". */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Очікується дата у форматі YYYY-MM-DD.");

/** ISO-datetime, що коректно парситься в Date. */
const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Очікується коректний ISO-datetime.");

/** Параметри запиту доступності (date АБО from+to). serviceIds — через кому. */
export const availabilityQuerySchema = z
  .object({
    serviceIds: z
      .string()
      .min(1)
      .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
    specialistId: z.string().min(1).optional(),
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    // "false" → false; будь-що інше або відсутнє → true (один слот на час).
    dedup: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v !== "false"),
  })
  .refine((q) => q.serviceIds.length > 0, { message: "Потрібна щонайменше одна послуга." })
  .refine((q) => Boolean(q.date) || (Boolean(q.from) && Boolean(q.to)), {
    message: "Вкажіть `date` або пару `from`+`to`.",
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, {
    message: "`from` має бути не пізніше за `to`.",
  });

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

/** Тіло POST /api/bookings. */
export const bookingRequestSchema = z.object({
  specialistId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, "Потрібна щонайменше одна послуга."),
  startTime: isoDateTime,
  patient: z.object({
    name: z.string().min(1, "Вкажіть ім'я."),
    phone: z
      .string()
      .refine((v) => digitsOnly(v).length >= 10, "Некоректний номер телефону."),
  }),
  comment: z.string().max(1000).optional(),
});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
