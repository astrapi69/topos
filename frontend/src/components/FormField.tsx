/**
 * Shared labelled form field: label text stacked above the control.
 *
 * Replaces the per-page FormField/EditField/Field triplets that each
 * page carried as inline-styled local components.
 *
 * @example
 * <FormField label={t("topos.container.label", "Bezeichnung")} testId="container-form-label-field">
 *     <input className={input} value={value} onChange={...} />
 * </FormField>
 */

import type { ReactNode } from "react";

import { muted } from "../ui/classes";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  /** Optional data-testid on the wrapping label element. */
  testId?: string;
  /** Extra classes on the wrapper (e.g. margins). */
  className?: string;
  /** Optional explanation shown under the control, muted and small. */
  hint?: string;
}

export default function FormField({
  label,
  children,
  testId,
  className = "",
  hint,
}: FormFieldProps) {
  return (
    <label
      data-testid={testId}
      className={`flex flex-col gap-1 text-sm ${className}`}
    >
      <span>{label}</span>
      {children}
      {hint && (
        <span
          className={`${muted} text-xs`}
          data-testid={testId && `${testId}-hint`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
