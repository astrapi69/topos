/**
 * Sortable/filterable container table.
 *
 * Filters: owner (self/parents/shared), type (folder/box),
 * substring on label/location. Click a row to open
 * ContainerDetail.
 */

import {useMemo, useState} from "react";
import {Link} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useContainers} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import type {ContainerType, Owner} from "../types/topos";

export default function ContainerList() {
    const {t} = useI18n();
    const {data, loading, error} = useContainers();
    const [owner, setOwner] = useState<Owner | "all">("all");
    const [type, setType] = useState<ContainerType | "all">("all");
    const [needle, setNeedle] = useState("");

    const filtered = useMemo(() => {
        return data.filter((c) => {
            if (owner !== "all" && c.owner !== owner) return false;
            if (type !== "all" && c.type !== type) return false;
            if (needle.trim()) {
                const n = needle.trim().toLowerCase();
                if (!c.label.toLowerCase().includes(n) && !(c.location ?? "").toLowerCase().includes(n)) {
                    return false;
                }
            }
            return true;
        });
    }, [data, owner, type, needle]);

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <h1 data-testid="container-list-title">
                    {t("topos.page.containers.title", "Container")}
                </h1>

                <section
                    data-testid="container-filters"
                    style={{display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap"}}
                >
                    <FilterSelect
                        label={t("topos.filter.owner", "Eigentümer")}
                        value={owner}
                        onChange={(v) => setOwner(v as Owner | "all")}
                        options={[
                            ["all", t("topos.filter.all", "Alle")],
                            ["self", t("topos.owner.self", "Ich")],
                            ["parents", t("topos.owner.parents", "Eltern")],
                            ["shared", t("topos.owner.shared", "Geteilt")],
                        ]}
                        testId="filter-owner"
                    />
                    <FilterSelect
                        label={t("topos.filter.type", "Typ")}
                        value={type}
                        onChange={(v) => setType(v as ContainerType | "all")}
                        options={[
                            ["all", t("topos.filter.all", "Alle")],
                            ["folder", t("topos.container.type.folder", "Ordner")],
                            ["box", t("topos.container.type.box", "Box")],
                        ]}
                        testId="filter-type"
                    />
                    <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem"}}>
                        {t("topos.filter.search", "Suche")}
                        <input
                            type="text"
                            value={needle}
                            onChange={(e) => setNeedle(e.target.value)}
                            data-testid="filter-needle"
                            placeholder={t(
                                "topos.filter.search_placeholder",
                                "Bezeichnung oder Ort",
                            )}
                        />
                    </label>
                </section>

                {loading && data.length === 0 && (
                    <p data-testid="container-list-loading">
                        {t("topos.common.loading", "Lade...")}
                    </p>
                )}
                {error && (
                    <p data-testid="container-list-error" style={{color: "#c00"}}>
                        {error.message}
                    </p>
                )}

                <table
                    data-testid="container-table"
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginTop: "0.5rem",
                    }}
                >
                    <thead>
                        <tr style={{textAlign: "left", borderBottom: "1px solid #ddd"}}>
                            <th style={{padding: "0.5rem"}}>{t("topos.container.external_id", "Nr.")}</th>
                            <th style={{padding: "0.5rem"}}>{t("topos.container.label", "Bezeichnung")}</th>
                            <th style={{padding: "0.5rem"}}>{t("topos.container.type_label", "Typ")}</th>
                            <th style={{padding: "0.5rem"}}>{t("topos.container.owner", "Eigentümer")}</th>
                            <th style={{padding: "0.5rem"}}>{t("topos.container.location", "Ort")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((c) => (
                            <tr
                                key={c.id}
                                data-testid={`container-row-${c.id}`}
                                style={{borderBottom: "1px solid #eee"}}
                            >
                                <td style={{padding: "0.5rem"}}>{c.externalId}</td>
                                <td style={{padding: "0.5rem"}}>
                                    <Link
                                        to={`/containers/${c.id}`}
                                        data-testid={`container-link-${c.id}`}
                                    >
                                        {c.label}
                                    </Link>
                                </td>
                                <td style={{padding: "0.5rem"}}>
                                    {t(`topos.container.type.${c.type}`, c.type)}
                                </td>
                                <td style={{padding: "0.5rem"}}>
                                    {t(`topos.owner.${c.owner}`, c.owner)}
                                </td>
                                <td style={{padding: "0.5rem"}}>{c.location ?? ""}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} style={{padding: "1rem", color: "#666"}}>
                                    {t("topos.page.containers.empty", "Keine Container gefunden.")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </main>
        </>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
    testId,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: [string, string][];
    testId: string;
}) {
    return (
        <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem"}}>
            {label}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                data-testid={testId}
            >
                {options.map(([v, l]) => (
                    <option key={v} value={v}>
                        {l}
                    </option>
                ))}
            </select>
        </label>
    );
}
