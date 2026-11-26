"use client";

import React from "react";
import { useVisualStyles } from "@/lib/useVisualStyles";
import {
  DEFAULT_VISUAL_STYLE_ID,
  type VisualStyleId,
  type VisualStyleSummaryOut,
} from "@/lib/types";
import {
  getStyleVisualMeta,
  getStyleSelectionDescription,
  resolveEffectiveStyle,
} from "@/lib/visual-style-ui";

export interface VisualStyleSelectorProps {
  value: VisualStyleId | null;
  onChange: (styleId: VisualStyleId | null) => void;
  channelDefaultStyleId?: VisualStyleId | null;
  disabled?: boolean;
  allowDeselect?: boolean;
  label?: string;
  hideResetButton?: boolean;
  hideStatusBanner?: boolean;
}

export function StyleMotifIcon({
  iconName,
  className = "w-7 h-7",
}: {
  iconName: "cube" | "stickman" | "drama";
  className?: string;
}) {
  if (iconName === "stickman") {
    return (
      <svg
        className={`${className} text-white/90 drop-shadow-md`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* White circle head */}
        <circle cx="12" cy="5" r="3" fill="#FFFFFF" stroke="#000000" strokeWidth="1.5" />
        {/* Slender stick body */}
        <line x1="12" y1="8" x2="12" y2="15" stroke="#FFFFFF" strokeWidth="2.5" />
        {/* Slender arms */}
        <line x1="8" y1="11" x2="16" y2="11" stroke="#FFFFFF" strokeWidth="2" />
        {/* Slender legs */}
        <line x1="12" y1="15" x2="8" y2="21" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="12" y1="15" x2="16" y2="21" stroke="#FFFFFF" strokeWidth="2" />
      </svg>
    );
  }

  if (iconName === "drama") {
    return (
      <svg
        className={`${className} text-pink-300 drop-shadow-[0_0_8px_rgba(233,30,99,0.7)]`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Chibi head with hair silhouette */}
        <path
          d="M12 3c-4.5 0-7 3-7 6.5 0 3 2.5 5.5 5.5 5.5h3c3 0 5.5-2.5 5.5-5.5C19 6 16.5 3 12 3z"
          fill="#FFFFFF"
          stroke="#212529"
          strokeWidth="1.25"
        />
        {/* Stylized eyes */}
        <ellipse cx="9.5" cy="9.5" rx="1.2" ry="1.8" fill="#212529" />
        <ellipse cx="14.5" cy="9.5" rx="1.2" ry="1.8" fill="#212529" />
        {/* Dramatic rim contour */}
        <path d="M7 16l-2 5h14l-2-5" stroke="#E91E63" strokeWidth="1.75" fill="rgba(233,30,99,0.3)" />
      </svg>
    );
  }

  // legacy_default: 3D isometric cube
  return (
    <svg
      className={`${className} text-sky-600 drop-shadow-sm`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2z"
        fill="url(#cube-gradient)"
        stroke="#60A5FA"
        strokeWidth="1.5"
      />
      <path d="M12 2v20" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M21 6.5l-9 5.5-9-5.5" stroke="#93C5FD" strokeWidth="1.5" />
      <defs>
        <linearGradient id="cube-gradient" x1="3" y1="2" x2="21" y2="22">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="50%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#FED7AA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Internal alias
const StyleIcon = StyleMotifIcon;

export function VisualStyleSelector({
  value,
  onChange,
  channelDefaultStyleId,
  disabled = false,
  allowDeselect = true,
  label = "Visual Style / Art Direction",
  hideResetButton = false,
  hideStatusBanner = false,
}: VisualStyleSelectorProps) {
  const { data, isLoading, isError, error, refetch } = useVisualStyles();

  const styles = data?.styles || [];
  const effectiveStyleId = resolveEffectiveStyle(value, channelDefaultStyleId);
  const selectionSummary = getStyleSelectionDescription(
    value,
    channelDefaultStyleId,
    styles
  );

  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Visual Style / Art Direction
          </label>
          <span className="text-[11px] text-slate-400">Loading styles...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 rounded-xl border border-slate-200 p-3 bg-slate-50/60 animate-pulse space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded-full w-12" />
                </div>
                <div className="h-14 bg-slate-200 rounded-lg" />
                <div className="h-2.5 bg-slate-200 rounded w-full" />
                <div className="h-2.5 bg-slate-100 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State with Retry
  if (isError) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          Visual Style / Art Direction
        </label>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <span>⚠️</span>
            <span>Unable to load visual style presets</span>
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            {error instanceof Error ? error.message : "Network error loading style catalog."} Video will use channel default unless retried.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] transition cursor-pointer"
          >
            <span>↻</span>
            <span>Retry loading styles</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Empty Response Fallback
  if (styles.length === 0) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          Visual Style / Art Direction
        </label>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 text-center">
          No visual styles currently available. Videos will use the system default Clean 3D style.
        </div>
      </div>
    );
  }

  const handleCardClick = (styleId: VisualStyleId) => {
    if (disabled) return;
    if (value === styleId) {
      if (allowDeselect) {
        onChange(null);
      }
    } else {
      onChange(styleId);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header and Reset Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            {label}
          </label>
          {allowDeselect && (
            <span className="text-[10px] text-slate-400 font-medium">(Optional)</span>
          )}
        </div>

        {!hideResetButton && Boolean(channelDefaultStyleId) && selectionSummary.isOverridden && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
            title="Revert to channel default"
          >
            <span>Reset to default</span>
            <span>↺</span>
          </button>
        )}
      </div>

      {/* Status Explanation Banner */}
      {!hideStatusBanner && (
        <div
          className={`px-3 py-1.5 rounded-lg text-[11px] border flex items-center justify-between gap-2 transition-colors ${
            selectionSummary.isOverridden
              ? "bg-indigo-50/80 border-indigo-200/90 text-indigo-900"
              : Boolean(channelDefaultStyleId)
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : "bg-amber-50/70 border-amber-200/80 text-amber-900"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span>{selectionSummary.isOverridden ? "✨" : Boolean(channelDefaultStyleId) ? "ℹ️" : "⚠️"}</span>
            <span className="truncate">
              {selectionSummary.isOverridden
                ? selectionSummary.summaryText
                : Boolean(channelDefaultStyleId)
                ? selectionSummary.summaryText
                : "No visual style selected. Please select a style below."}
            </span>
          </div>

          <span
            className={`shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
              selectionSummary.isOverridden
                ? "bg-indigo-600 text-white"
                : Boolean(channelDefaultStyleId)
                ? "bg-slate-200 text-slate-700"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {selectionSummary.isOverridden ? "Selected" : Boolean(channelDefaultStyleId) ? "Inherited" : "Required"}
          </span>
        </div>
      )}

      {/* Visual Style Cards Grid */}
      <div
        role="radiogroup"
        aria-label="Visual style presets"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      >
        {styles.map((style: VisualStyleSummaryOut) => {
          const isExplicitlySelected = value === style.id;
          const isInheritedDefault =
            Boolean(channelDefaultStyleId) && value === null && effectiveStyleId === style.id;
          const isChannelDefault = Boolean(channelDefaultStyleId) && channelDefaultStyleId === style.id;
          const isSystemDefault =
            allowDeselect && !channelDefaultStyleId && style.id === DEFAULT_VISUAL_STYLE_ID;

          const meta = getStyleVisualMeta(style.id);

          return (
            <div
              key={style.id}
              role="radio"
              aria-checked={isExplicitlySelected}
              aria-label={style.name}
              tabIndex={disabled ? -1 : 0}
              onClick={() => handleCardClick(style.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleCardClick(style.id);
                }
              }}
              className={`group relative rounded-xl border p-3 flex flex-col justify-between transition-all duration-150 select-none ${
                disabled
                  ? "opacity-60 cursor-not-allowed"
                  : "cursor-pointer hover:shadow-xs"
              } ${
                isExplicitlySelected
                  ? "border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/20"
                  : isInheritedDefault
                  ? "border-slate-300 ring-1 ring-slate-300/80 bg-slate-50/50 hover:border-slate-400"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="space-y-2">
                {/* Card Title & Radio Badge Header */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Radio visual indicator */}
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isExplicitlySelected
                          ? "border-indigo-600 bg-indigo-600"
                          : isInheritedDefault
                          ? "border-slate-400 bg-slate-100"
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {isExplicitlySelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                      {isInheritedDefault && (
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                      )}
                    </span>

                    <span className="font-bold text-xs text-slate-900 truncate tracking-tight">
                      {style.name}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="shrink-0">
                    {isExplicitlySelected ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                        Selected
                      </span>
                    ) : isInheritedDefault ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                        Inherited
                      </span>
                    ) : isChannelDefault ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Default
                      </span>
                    ) : isSystemDefault ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Default
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* CSS-Based Visual Illustration Box with Motif & Palette Swatches */}
                <div
                  className={`relative h-14 rounded-lg bg-gradient-to-br ${meta.gradientClass} border ${meta.accentBorderClass} overflow-hidden p-2 flex items-center justify-between shadow-2xs`}
                >
                  {/* Visual Style Motif Icon */}
                  <div className="flex items-center justify-center pl-1">
                    <StyleIcon iconName={meta.iconName} />
                  </div>

                  {/* Right side: Category badge & Palette Swatches */}
                  <div className="flex flex-col items-end justify-between h-full space-y-1">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${meta.badgeClass}`}
                    >
                      {meta.badgeLabel}
                    </span>

                    {/* Palette Swatches */}
                    <div
                      className="flex items-center gap-1 bg-black/25 backdrop-blur-xs px-1.5 py-0.5 rounded-full"
                      title="Representative style color palette"
                    >
                      {meta.swatches.map((color, sIdx) => (
                        <span
                          key={sIdx}
                          style={{ backgroundColor: color }}
                          className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  className="text-[11px] text-slate-600 leading-relaxed line-clamp-3"
                  title={style.description}
                >
                  {style.description}
                </p>
              </div>

              {/* Bottom selection hint */}
              <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                <span>
                  {isExplicitlySelected
                    ? allowDeselect
                      ? "Click to unselect"
                      : "Selected"
                    : isInheritedDefault
                    ? "Active by default"
                    : "Click to select"}
                </span>
                <span className="font-mono text-[9px]">v{style.version}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
