"use client";

import type { StepOut } from "@/lib/types";
import { StepCard } from "./StepCard";

interface StepTimelineProps {
  steps: StepOut[];
  isAnyRunning: boolean;
  onRerun: (stepName: string, prompt?: string) => Promise<void>;
}

export function StepTimeline({ steps, isAnyRunning, onRerun }: StepTimelineProps) {
  // Sort steps by position 1..5
  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {sortedSteps.map((step, index) => (
        <div key={step.name} className="relative">
          {/* Vertical connecting line */}
          {index < sortedSteps.length - 1 && (
            <div
              className={`absolute left-7.5 top-14 bottom-[-16px] w-0.5 z-0 ${
                step.status === "done" ? "bg-emerald-300" : "bg-slate-200"
              }`}
            />
          )}

          <div className="relative z-10">
            <StepCard
              step={step}
              allSteps={sortedSteps}
              isAnyRunning={isAnyRunning}
              onRerun={onRerun}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
