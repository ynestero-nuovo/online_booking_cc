"use client";

import Image from "next/image";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Аватар спеціаліста: фото (next/image) або ініціали як фолбек. */
export default function Avatar({
  name,
  photoUrl,
  size = 48,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600"
    >
      {initials(name)}
    </span>
  );
}
