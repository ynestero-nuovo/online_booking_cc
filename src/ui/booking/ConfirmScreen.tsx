"use client";

import { useState } from "react";
import Overlay from "./Overlay";
import Markdown from "./Markdown";
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from "@/lib/policy";

/** Форматує до 10 національних цифр як "0XX XXX XX XX". */
function formatNational(d: string): string {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}

/** Дістає національні 10 цифр з довільного вводу (відкидає +38/380 за наявності). */
function parseNational(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("38")) d = d.slice(2); // прибираємо код країни, якщо вставили повний номер
  return d.slice(0, 10);
}

export default function ConfirmScreen({
  summary,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  summary: { specialist: string; services: string; when: string; price: string };
  loading: boolean;
  error: string | null;
  /** phone — повний номер у форматі +38XXXXXXXXXX. */
  onSubmit: (data: { name: string; phone: string; comment: string }) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // національні цифри (до 10)
  const [comment, setComment] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<"terms" | "privacy" | null>(null);

  const phoneComplete = phone.length === 10;
  const valid = name.trim().length > 0 && phoneComplete && accepted;

  return (
    <>
    <Overlay
      title="Підтвердження"
      onBack={onBack}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <input
              id="accept-terms"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
            />
            <span className="text-sm leading-snug text-zinc-600">
              Я приймаю умови{" "}
              <button
                type="button"
                onClick={() => setPolicy("terms")}
                className="text-brand underline underline-offset-2"
              >
                Користувацької угоди
              </button>{" "}
              та{" "}
              <button
                type="button"
                onClick={() => setPolicy("privacy")}
                className="text-brand underline underline-offset-2"
              >
                Політику конфіденційності
              </button>
            </span>
          </div>
          <button
            type="button"
            disabled={loading || !valid}
            onClick={() =>
              onSubmit({ name: name.trim(), phone: `+38${phone}`, comment: comment.trim() })
            }
            className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white active:bg-brand-dark disabled:opacity-40"
          >
            {loading ? "Записуємо…" : "Підтвердити запис"}
          </button>
        </div>
      }
    >
      <dl className="mb-5 rounded-xl bg-zinc-50 p-4 text-sm">
        <Row label="Фахівець" value={summary.specialist} />
        <Row label="Послуги" value={summary.services} />
        <Row label="Час" value={summary.when} />
        <Row label="Вартість" value={summary.price} />
      </dl>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-3">
        <Field label="Ім'я" value={name} onChange={setName} placeholder="Як до вас звертатися" />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Телефон</span>
          <div
            className={`flex h-12 items-center rounded-xl border ${
              phone.length > 0 && !phoneComplete ? "border-amber-400" : "border-zinc-200"
            } px-3 focus-within:border-brand`}
          >
            <span className="select-none text-base text-zinc-500">+38</span>
            <input
              type="tel"
              inputMode="numeric"
              value={formatNational(phone)}
              placeholder="0XX XXX XX XX"
              onChange={(e) => setPhone(parseNational(e.target.value))}
              className="ml-2 h-full flex-1 bg-transparent text-base outline-none"
            />
          </div>
          {phone.length > 0 && !phoneComplete && (
            <span className="text-xs text-amber-600">Введіть 10 цифр номера (напр. 096 986 05 87)</span>
          )}
        </label>

        <Field label="Коментар" value={comment} onChange={setComment} placeholder="Необов'язково" />
      </div>
    </Overlay>

    {policy && (
      <Overlay
        title={policy === "terms" ? "Користувацька угода" : "Політика конфіденційності"}
        onBack={() => setPolicy(null)}
      >
        <Markdown source={policy === "terms" ? TERMS_OF_SERVICE : PRIVACY_POLICY} />
      </Overlay>
    )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-900">{value}</dd>
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
        className="h-12 rounded-xl border border-zinc-200 px-3 text-base outline-none focus:border-brand"
      />
    </label>
  );
}
