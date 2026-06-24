"use client";

/** Екран успіху: показує деталі створеного запису та кнопку «Новий запис». */
export default function SuccessScreen({
  specialistName,
  serviceNames,
  dateLabel,
  timeLabel,
  onReset,
}: {
  specialistName: string;
  serviceNames: string[];
  dateLabel: string;
  timeLabel: string;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
        ✓
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">Вас записано!</h2>

      <dl className="w-full max-w-sm rounded-xl bg-zinc-50 p-4 text-left text-sm">
        <div className="flex justify-between gap-3 py-1">
          <dt className="shrink-0 text-zinc-500">Послуги</dt>
          <dd className="text-right font-medium text-zinc-900">{serviceNames.join(", ")}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <dt className="shrink-0 text-zinc-500">Фахівець</dt>
          <dd className="text-right font-medium text-zinc-900">{specialistName}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <dt className="shrink-0 text-zinc-500">Дата</dt>
          <dd className="text-right font-medium text-zinc-900">{dateLabel}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <dt className="shrink-0 text-zinc-500">Час</dt>
          <dd className="text-right font-medium text-zinc-900">{timeLabel}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onReset}
        className="h-12 w-full max-w-sm rounded-xl bg-zinc-100 text-base font-semibold text-zinc-800"
      >
        Новий запис
      </button>
    </div>
  );
}
