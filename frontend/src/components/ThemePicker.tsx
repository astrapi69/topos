/**
 * ThemePicker - a radiogroup of preview cards for the multi-theme system.
 *
 * Adapted from adaptive-learner's ThemePicker onto Topos's ui/classes and
 * useTheme. Each card shows a swatch built from the theme's previewColors
 * (inline style - dynamic per-theme data, not Tailwind classes) plus a
 * localized label + description. Selecting a card calls setTheme, which
 * flips both <html> attributes (see hooks/useTheme.ts).
 */

import { Check } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { useTheme } from "../hooks/useTheme";
import { THEMES, type Theme } from "../themes/themes";
import { card, muted, selected } from "../ui/classes";

function Swatch({ theme }: { theme: Theme }) {
  const { bg, accent, fg } = theme.previewColors;
  return (
    <span
      aria-hidden
      className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-line"
      style={{ background: bg, color: fg }}
    >
      <span className="text-xs font-semibold" style={{ color: fg }}>
        Aa
      </span>
      <span
        className="ml-1 inline-block h-4 w-2 rounded-sm"
        style={{ background: accent }}
      />
    </span>
  );
}

export default function ThemePicker() {
  const { t } = useI18n();
  const { theme: activeId, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t("topos.page.settings.theme", "Erscheinungsbild")}
      data-testid="theme-picker"
      className="flex flex-col gap-2"
    >
      {THEMES.map((theme) => {
        const active = activeId === theme.id;
        const label = t(`topos.theme.${theme.id}.label`, theme.label);
        const desc = t(`topos.theme.${theme.id}.desc`, theme.description);
        return (
          <label
            key={theme.id}
            data-testid={`theme-option-${theme.id}`}
            className={`${card} flex cursor-pointer items-center gap-3 p-3 ${
              active ? `${selected} border-accent` : "hover:bg-surface-hover"
            }`}
          >
            <input
              type="radio"
              name="topos-theme"
              value={theme.id}
              checked={active}
              onChange={() => setTheme(theme.id)}
              className="sr-only"
            />
            <Swatch theme={theme} />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold text-ink">{label}</span>
              <span className={`text-sm ${muted}`}>{desc}</span>
            </span>
            {active && (
              <Check
                size={18}
                aria-hidden
                className="ml-auto shrink-0 text-accent"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
