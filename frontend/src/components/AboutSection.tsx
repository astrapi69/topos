/**
 * About section for Settings ("Ueber Topos").
 *
 * Shows the running build (VersionCard from @astrapi69/pwa-update-react,
 * fed the build-time defines), the MIT license + source link, a
 * "report a problem" trigger (opens the existing ErrorReportDialog via its
 * window event), and donation channels. Donation links mirror the
 * adaptive-learner set - same maintainer (astrapi69), so the same URLs apply.
 *
 * Styled with Topos token classes (ui/classes); the donation channel list is
 * data-driven so a channel can be added/removed by editing one array entry.
 */

import {VersionCard} from "@astrapi69/pwa-update-react";

import {useI18n} from "../hooks/useI18n";
import {card, link, muted, pill} from "../ui/classes";

const REPO_URL = "https://github.com/astrapi69/topos";
const LICENSE_URL = "https://github.com/astrapi69/topos/blob/main/LICENSE";

interface DonationChannel {
    id: string;
    label: string;
    descKey: string;
    descFallback: string;
    url: string;
    primary?: boolean;
}

const DONATION_CHANNELS: readonly DonationChannel[] = [
    {
        id: "liberapay",
        label: "Liberapay",
        descKey: "topos.page.settings.about.donate_liberapay",
        descFallback: "Wiederkehrende Spenden, ohne Plattform-Gebuehr.",
        url: "https://liberapay.com/astrapi69/donate",
        primary: true,
    },
    {
        id: "github-sponsors",
        label: "GitHub Sponsors",
        descKey: "topos.page.settings.about.donate_github",
        descFallback: "Ueber dein bestehendes GitHub-Konto.",
        url: "https://github.com/sponsors/astrapi69",
    },
    {
        id: "kofi",
        label: "Ko-fi",
        descKey: "topos.page.settings.about.donate_kofi",
        descFallback: "Einmalige Trinkgelder, kein Login noetig.",
        url: "https://ko-fi.com/astrapi69",
    },
];

function openErrorReport() {
    window.dispatchEvent(new CustomEvent("topos:open-error-report", {detail: {}}));
}

export default function AboutSection() {
    const {t} = useI18n();

    return (
        <section style={{marginBottom: "1.5rem"}} data-testid="about-section">
            <h2>{t("topos.page.settings.about.heading", "Über Topos")}</h2>

            <VersionCard
                testId="about-version-card"
                testIds={{
                    version: "about-app-version",
                    hash: "about-build-hash",
                    hashLink: "about-build-hash-link",
                    date: "about-build-date",
                }}
                version={typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown"}
                buildHash={typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "unknown"}
                buildDate={typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : ""}
                commitUrl={(hash) => `${REPO_URL}/commit/${hash}`}
            />

            <ul
                className="mt-3 flex flex-col gap-1"
                style={{listStyle: "none", padding: 0, margin: "0.75rem 0 0"}}
                data-testid="about-links"
            >
                <li>
                    {t("topos.page.settings.about.license", "Lizenz")}:{" "}
                    <a
                        className={link}
                        href={LICENSE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-license-link"
                    >
                        MIT
                    </a>
                </li>
                <li>
                    <a
                        className={link}
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-repo-link"
                    >
                        {t("topos.page.settings.about.source", "Quellcode auf GitHub")}
                    </a>
                </li>
                <li>
                    <button
                        type="button"
                        className={link}
                        onClick={openErrorReport}
                        data-testid="about-report-issue"
                    >
                        {t("topos.page.settings.about.report", "Problem melden")}
                    </button>
                </li>
            </ul>

            <div className={`${card} mt-3 p-3`} data-testid="about-donations">
                <h3 className="font-semibold">
                    {t("topos.page.settings.about.donate_heading", "Entwicklung unterstützen")}
                </h3>
                <p className={`${muted} mt-1 text-sm`}>
                    {t(
                        "topos.page.settings.about.donate_intro",
                        "Topos ist frei und Open Source. Wenn es dir hilft, freue ich mich über einen Beitrag.",
                    )}
                </p>
                <ul
                    className="mt-2 flex flex-col gap-2"
                    style={{listStyle: "none", padding: 0, margin: "0.5rem 0 0"}}
                    data-testid="about-donations-list"
                >
                    {DONATION_CHANNELS.map((channel) => (
                        <li key={channel.id} data-testid={`about-donation-${channel.id}`}>
                            <a
                                className={link}
                                href={channel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`about-donation-${channel.id}-link`}
                            >
                                {channel.label}
                            </a>
                            {channel.primary && (
                                <span
                                    className={`${pill} ml-2`}
                                    data-testid="about-donation-preferred"
                                >
                                    {t("topos.page.settings.about.donate_preferred", "bevorzugt")}
                                </span>
                            )}
                            <span className={`${muted} block text-sm`}>
                                {t(channel.descKey, channel.descFallback)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
