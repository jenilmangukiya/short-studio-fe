"use client";

import { useState } from "react";

interface CollapsibleJsonProps {
  data: unknown;
  mock?: boolean;
  defaultOpen?: boolean;
  label?: string;
}

export function CollapsibleJson({
  data,
  mock = false,
  defaultOpen = false,
  label = "Raw Output",
}: CollapsibleJsonProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (data === null || data === undefined) {
    return (
      <div className="text-xs text-slate-400 italic py-2">
        No output generated yet.
      </div>
    );
  }

  const jsonString = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer transition select-none"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">{label}</span>
          {mock && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Mock
            </span>
          )}
        </div>
        <span className="text-slate-500 font-mono text-xs">
          {isOpen ? "▲ Hide" : "▼ Expand JSON"}
        </span>
      </div>

      {isOpen && (
        <div className="p-3 bg-slate-900 text-slate-100 overflow-x-auto max-h-96 text-xs font-mono">
          <pre>{jsonString}</pre>
        </div>
      )}
    </div>
  );
}
