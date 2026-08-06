/**
 * iosInstall - platform detection for the iOS "Add to Home Screen" hint.
 *
 * iOS Safari fires no `beforeinstallprompt` event, so `usePwaInstall` never
 * yields a prompt there. The only way to a chrome-less standalone app on
 * iPhone/iPad is adding the PWA to the home screen via the Share sheet. We
 * surface a short, dismissable instruction - but ONLY on iOS Safari and ONLY
 * before the app is installed, so it never appears where it cannot apply.
 *
 * Pure functions over explicit inputs so they unit-test without stubbing
 * `navigator`; the component reads the real values and passes them in.
 * Ported from adaptive-learner (src/lib/pwa/ios-install.ts).
 */

/**
 * True for an iOS device. iPadOS 13+ reports as desktop Safari, so the
 * `MacIntel` + multi-touch combination is treated as iPad.
 */
export function isIosDevice(userAgent: string, platform: string, maxTouchPoints: number): boolean {
    if (/\b(iphone|ipod|ipad)\b/i.test(userAgent)) return true;
    return platform === "MacIntel" && maxTouchPoints > 1;
}

/**
 * True when the iOS browser is Safari (the only iOS browser that can add to
 * the home screen). Other iOS browsers are WebKit shells that cannot, so we
 * exclude them by their UA tokens.
 */
export function isIosSafari(userAgent: string): boolean {
    return !/\b(crios|fxios|edgios|opios|mercury|gsa)\b/i.test(userAgent);
}

/** True when the page runs as an installed, chrome-less PWA. */
export function isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    const displayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    // iOS Safari exposes the legacy navigator.standalone flag instead.
    const iosStandalone = (window.navigator as Navigator & {standalone?: boolean}).standalone === true;
    return displayMode || iosStandalone;
}

export interface IosHintInputs {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
    /** Already running as an installed PWA (display-mode standalone). */
    standalone: boolean;
    /** The user already dismissed the hint. */
    dismissed: boolean;
}

/**
 * Whether to show the iOS "Add to Home Screen" hint: an iOS-Safari device that
 * is not already installed and has not dismissed the hint.
 */
export function shouldShowIosInstallHint(inputs: IosHintInputs): boolean {
    if (inputs.standalone || inputs.dismissed) return false;
    if (!isIosDevice(inputs.userAgent, inputs.platform, inputs.maxTouchPoints)) {
        return false;
    }
    return isIosSafari(inputs.userAgent);
}
