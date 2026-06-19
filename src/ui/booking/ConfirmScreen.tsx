"use client";

import { useState } from "react";
import Overlay from "./Overlay";

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
  onSubmit: (data: { name: string; phone: string; comment: string }) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const valid = name.trim().length > 0 && phone.trim().length >= 5;

  return (
    <Overlay
      title="Підтвердження"
      onBack={onBack}
      footer={
        <button
          type="button"
          disabled={loading || !valid}
          onClick={() => onSubmit({ name: name.trim(), phone: phone.trim(), comment: comment.trim() })}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white active:bg-brand-dark disabled:opacity-40"
        >
          {loading ? "Записуємо…" : "Підтвердити запис"}
        </button>
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
        <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+380…" type="tel" />
        <Field label="Коментар" value={comment} onChange={setComment} placeholder="Необов'язково" />
      </div>
    </Overlay>
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
