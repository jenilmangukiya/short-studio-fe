"use client";

import React, { useRef } from "react";
import type { StepOut, StepStatus } from "@/lib/types";

interface StepStepperProps {
  steps: StepOut[];
  shownStepName: string;
  currentStepName: string;
  onSelectStep: (stepName: string) => void;
  onGoToCurrent: () => void;
}

function getStatusDetails(status: StepStatus | string) {
  switch (status) {
    case "done":
      return {
        label: "done",
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-300",
        icon: "✓",
        dotColor: "bg-emerald-500",
      };
    case "running":
      return {
        label: "running",
        badgeBg: "bg-blue-50 text-blue-700 border-blue-300",
        icon: "⚡",
        dotColor: "bg-blue-600 animate-ping",
      };
    case "failed":
      return {
        label: "failed",
        badgeBg: "bg-red-50 text-red-700 border-red-300",
        icon: "✕",
        dotColor: "bg-red-500",
      };
    case "stale":
      return {
        label: "stale",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-300",
        icon: "⏳",
        dotColor: "bg-amber-500",
      };
    case "pending":
    default:
      return {
        label: "pending",
        badgeBg: "bg-slate-100 text-slate-600 border-slate-300",
        icon: "○",
        dotColor: "bg-slate-400",
      };
  }
}

export function StepStepper({
  steps,
  shownStepName,
  currentStepName,
  onSelectStep,
  onGoToCurrent,
}: StepStepperProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keyboard navigation for roving tabindex (WAI-ARIA tabs)
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = index;

    if (e.key === "ArrowRight") {
      targetIndex = (index + 1) % steps.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (index - 1 + steps.length) % steps.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = steps.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const targetStep = steps[targetIndex];
    if (targetStep) {
      onSelectStep(targetStep.name);
      tabRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="space-y-2">
      {/* Top Helper: Go to current step link when user is viewing another step */}
      <div className="flex items-center justify-between min-h-6 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Pipeline Steps
        </span>

        {shownStepName !== currentStepName && (
          <button
            type="button"
            onClick={onGoToCurrent}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition"
          >
            <span>&rarr;</span>
            <span>
              Go to current step (<span className="capitalize">{currentStepName}</span>)
            </span>
          </button>
        )}
      </div>

      {/* Horizontal Stepper Row */}
      <div
        role="tablist"
        aria-label="Pipeline steps"
        className="flex items-stretch gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1"
      >
        {steps.map((step, idx) => {
          const isSelected = step.name === shownStepName;
          const isCurrent = step.name === currentStepName;
          const { label, badgeBg, icon, dotColor } = getStatusDetails(step.status);
          const isRunning = step.status === "running";

          return (
            <button
              key={step.name}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              id={`tab-${step.name}`}
              aria-selected={isSelected}
              aria-controls={`panel-${step.name}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectStep(step.name)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`flex-1 min-w-[150px] sm:min-w-[170px] shrink-0 text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isSelected
                  ? "bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm"
                  : "bg-white/70 hover:bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              {/* Step Number + Active Highlight Dot */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {step.position}
                </span>

                {isCurrent && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    Current
                  </span>
                )}
              </div>

              {/* Step Name */}
              <div className="font-bold text-sm text-slate-900 capitalize truncate mb-2">
                {step.name}
              </div>

              {/* Status Badge with Icon + Text */}
              <div className="flex items-center">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeBg}`}
                >
                  {isRunning ? (
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  ) : (
                    <span className="font-bold leading-none">{icon}</span>
                  )}
                  <span>{label}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
