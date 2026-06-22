import type { ReactNode } from "react";

/** Рендерить **жирний** усередині рядка. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*/).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}

/** Мінімальний markdown → JSX: # / ## / ###, **жирний**, списки «- », ---, абзаци. */
export default function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const k = blocks.length;
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={k} className="mt-3 font-semibold text-zinc-900">{inline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={k} className="mt-4 text-base font-semibold text-zinc-900">{inline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h1 key={k} className="text-xl font-bold text-zinc-900">{inline(line.slice(2))}</h1>);
    } else if (line.startsWith("---")) {
      blocks.push(<hr key={k} className="my-3 border-zinc-200" />);
    } else {
      blocks.push(<p key={k} className="leading-relaxed">{inline(line)}</p>);
    }
  }
  flushList();

  return <div className="space-y-2 text-sm text-zinc-700">{blocks}</div>;
}
