/**
 * Topos design-system slots for the ai-key-vault-react settings UI.
 *
 * The kit ships unstyled defaults and takes a host's Button / Input / Link
 * primitives via ``AiSettingsProvider`` so its components match the app's
 * look. These map the kit's slot contracts onto Topos's shared Tailwind
 * class strings (``ui/classes``) and react-router ``Link``. Defined at module
 * level so the component identities stay stable across renders (a fresh
 * Input identity each render would remount and blur the field).
 */

import * as React from "react";
import {Link as RouterLink} from "react-router-dom";

import type {
    ButtonSlot,
    ButtonSlotProps,
    InputSlot,
    InputSlotProps,
    LinkSlot,
    LinkSlotProps,
} from "@astrapi69/ai-key-vault-react";

import {btn, btnDanger, btnPrimary, btnText, input} from "../ui/classes";

function join(...classes: (string | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}

/** Map the kit's button variant onto a Topos class string. */
function variantClass(variant: ButtonSlotProps["variant"]): string {
    switch (variant) {
        case "destructive":
            return btnDanger;
        case "secondary":
        case "outline":
            return btn;
        case "link":
            return btnText;
        default:
            return btnPrimary;
    }
}

/** Button slot: Topos button classes keyed off the kit's variant. */
export const ToposButton: ButtonSlot = ({variant, size: _size, className, ...rest}) => (
    <button {...rest} className={join(variantClass(variant), className)} />
);
ToposButton.displayName = "ToposButton";

/** Input slot: Topos form-control class, forwarded ref. */
export const ToposInput: InputSlot = React.forwardRef<HTMLInputElement, InputSlotProps>(
    ({className, ...rest}, ref) => (
        <input ref={ref} {...rest} className={join(input, className)} />
    ),
);
ToposInput.displayName = "ToposInput";

/** Link slot: react-router ``Link`` (client-side routing). */
export const ToposLink: LinkSlot = ({to, className, children, ...rest}: LinkSlotProps) => (
    <RouterLink to={to} className={className} {...rest}>
        {children}
    </RouterLink>
);
ToposLink.displayName = "ToposLink";
