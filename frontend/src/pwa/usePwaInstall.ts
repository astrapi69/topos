/**
 * Captures the browser's `beforeinstallprompt` event so the app can offer
 * a custom "install" affordance, and hides it once installed.
 */

import {useCallback, useEffect, useState} from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

export function usePwaInstall(): {canInstall: boolean; promptInstall: () => Promise<void>} {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const onBeforeInstall = (e: Event) => {
            e.preventDefault(); // stop Chrome's default mini-infobar
            setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setDeferred(null);
        };
        window.addEventListener("beforeinstallprompt", onBeforeInstall);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstall);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferred) return;
        await deferred.prompt();
        // The event can only be used once.
        setDeferred(null);
    }, [deferred]);

    return {canInstall: deferred !== null && !installed, promptInstall};
}
