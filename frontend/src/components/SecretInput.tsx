/**
 * SecretInput - a masked field for secrets the browser password manager must
 * NOT capture (here: the local key-vault passphrase).
 *
 * A `type="password"` field invites credential autofill (Chrome, 1Password,
 * LastPass, Bitwarden, ...) and hides the value with no way to reveal it - the
 * wrong behaviour for a vault passphrase the user wants to see and verify.
 * Instead this renders a plain `type="text"` input, masks it with
 * `-webkit-text-security`, suppresses the known password-manager heuristics,
 * and provides its own show/hide toggle.
 *
 * This is a standalone twin of the kit's `SecretInput` (which reads the
 * AiSettings context for its Input slot); this one has no context dependency,
 * so it works in the passphrase modal that lives OUTSIDE the AiSettingsProvider.
 */

import {
  forwardRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { input as inputClass } from "../ui/classes";

export interface SecretInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  /** Extra classes for the positioned wrapper around input + toggle. */
  wrapperClassName?: string;
}

export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  function SecretInput({ wrapperClassName, className, style, ...rest }, ref) {
    const { t } = useI18n();
    const [revealed, setRevealed] = useState(false);

    // `-webkit-text-security` is non-standard, so it is not in CSSProperties.
    const maskStyle = {
      WebkitTextSecurity: revealed ? "none" : "disc",
      ...style,
    } as CSSProperties;

    return (
      <div className={`relative ${wrapperClassName ?? ""}`}>
        <input
          ref={ref}
          type="text"
          // Suppress browser + password-manager autofill/save heuristics.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          className={`${inputClass} w-full pr-10 ${className ?? ""}`}
          style={maskStyle}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          aria-label={
            revealed
              ? t("common.hide", "Verbergen")
              : t("common.show", "Anzeigen")
          }
          className="absolute inset-y-0 right-0 flex items-center px-2 text-ink-muted hover:text-ink"
          // Not a focus stop: keep tabbing between the passphrase fields.
          tabIndex={-1}
          data-testid="secret-input-toggle"
        >
          {revealed ? (
            <EyeOff size={16} aria-hidden />
          ) : (
            <Eye size={16} aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
