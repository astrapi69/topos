/**
 * Topos design-system Button slot for @astrapi69/pwa-update-react.
 *
 * The kit takes a host's Button primitive via `PwaUpdateProvider` so its
 * banner/controls match the app's look. This maps the kit's button variant
 * (`default | outline | ghost`) onto Topos's shared Tailwind class strings
 * (`ui/classes`). Defined at module level so the component identity stays
 * stable across renders. Mirrors ai/settingsSlots.tsx for the ai-key-vault
 * kit.
 */

import type { ButtonSlot, ButtonSlotProps } from "@astrapi69/pwa-update-react";

import { btn, btnPrimary, btnText } from "../ui/classes";

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Map the kit's button variant onto a Topos class string. */
function variantClass(variant: ButtonSlotProps["variant"]): string {
  switch (variant) {
    case "outline":
      return btn;
    case "ghost":
      return btnText;
    default:
      return btnPrimary;
  }
}

/** Button slot: Topos button classes keyed off the kit's variant. */
export const ToposUpdateButton: ButtonSlot = ({
  variant,
  size: _size,
  className,
  ...rest
}) => <button {...rest} className={join(variantClass(variant), className)} />;
ToposUpdateButton.displayName = "ToposUpdateButton";
