/**
 * Container detail with the child item list and a "new item" launcher.
 */

import {useParams, Link, useNavigate} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useContainer, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {api} from "../api/client";
import {notify, errorMessage} from "../utils/notify";

export default function ContainerDetail() {
    const {t} = useI18n();
    const params = useParams<{id: string}>();
    const navigate = useNavigate();
    const containerId = params.id ? Number(params.id) : null;
    const {data: container, loading, error} = useContainer(containerId);
    const items = useItems({containerId: containerId ?? undefined});
    const {confirm} = useDialog();

    if (containerId === null) {
        return (
            <>
                <NavBar />
                <main style={{padding: "1.5rem"}}>
                    <p>{t("topos.page.container_detail.no_id", "Kein Container ausgewählt.")}</p>
                </main>
            </>
        );
    }

    async function handleDelete(itemId: number, itemContent: string) {
        const ok = await confirm(
            t("topos.confirm.delete_item_title", "Eintrag löschen?"),
            t(
                "topos.confirm.delete_item_message",
                "Der Eintrag \"{content}\" wird dauerhaft gelöscht.",
            ).replace("{content}", itemContent),
            "danger",
            {
                confirmLabel: t("topos.common.delete", "Löschen"),
                cancelLabel: t("topos.common.cancel", "Abbrechen"),
            },
        );
        if (!ok) return;
        try {
            await api.items.delete(itemId);
            await items.refresh();
            notify.success(t("topos.toast.item_deleted", "Eintrag gelöscht"));
        } catch (e) {
            notify.error(
                errorMessage(e, t("topos.toast.item_delete_failed", "Eintrag konnte nicht gelöscht werden")),
                e,
            );
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <Link to="/containers" data-testid="container-detail-back">
                    {t("topos.common.back", "Zurück")}
                </Link>
                <h1 data-testid="container-detail-title">
                    {container?.label ??
                        (loading
                            ? t("topos.common.loading", "Lade...")
                            : t("topos.page.container_detail.missing", "Container nicht gefunden"))}
                </h1>
                {error && (
                    <p data-testid="container-detail-error" style={{color: "var(--danger)"}}>
                        {error.message}
                    </p>
                )}

                {container && (
                    <dl
                        data-testid="container-meta"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "max-content auto",
                            gap: "0.25rem 0.75rem",
                            marginBottom: "1.5rem",
                        }}
                    >
                        <dt>{t("topos.container.external_id", "Nr.")}</dt>
                        <dd>{container.externalId}</dd>
                        <dt>{t("topos.container.type_label", "Typ")}</dt>
                        <dd>{t(`topos.container.type.${container.type}`, container.type)}</dd>
                        <dt>{t("topos.container.owner", "Eigentümer")}</dt>
                        <dd>{t(`topos.owner.${container.owner}`, container.owner)}</dd>
                        <dt>{t("topos.container.location", "Ort")}</dt>
                        <dd>{container.location ?? ""}</dd>
                        {container.sizeGroup && (
                            <>
                                <dt>{t("topos.container.size_group", "Grössengruppe")}</dt>
                                <dd>{container.sizeGroup}</dd>
                            </>
                        )}
                        {container.description && (
                            <>
                                <dt>{t("topos.container.description", "Beschreibung")}</dt>
                                <dd style={{whiteSpace: "pre-line"}}>{container.description}</dd>
                            </>
                        )}
                    </dl>
                )}

                <section>
                    <header
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h2>{t("topos.page.container_detail.items", "Einträge")}</h2>
                        <button
                            type="button"
                            data-testid="container-detail-new-item"
                            onClick={() =>
                                navigate(`/items/new?container_id=${containerId}`)
                            }
                        >
                            {t("topos.page.container_detail.new_item", "Neuer Eintrag")}
                        </button>
                    </header>

                    <table
                        data-testid="container-detail-items"
                        style={{width: "100%", borderCollapse: "collapse", marginTop: "0.5rem"}}
                    >
                        <thead>
                            <tr style={{textAlign: "left", borderBottom: "1px solid var(--border)"}}>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.content", "Inhalt")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.priority", "Priorität")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.category", "Kategorie")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.common.actions", "Aktionen")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.data.map((item) => (
                                <tr
                                    key={item.id}
                                    data-testid={`item-row-${item.id}`}
                                    style={{borderBottom: "1px solid var(--border)"}}
                                >
                                    <td style={{padding: "0.5rem"}}>{item.content}</td>
                                    <td style={{padding: "0.5rem"}}>
                                        {t(`topos.priority.${item.priority}`, item.priority)}
                                    </td>
                                    <td style={{padding: "0.5rem"}}>{item.categoryPath ?? ""}</td>
                                    <td style={{padding: "0.5rem"}}>
                                        <Link
                                            to={`/items/${item.id}`}
                                            data-testid={`edit-item-${item.id}`}
                                        >
                                            {t("topos.common.edit", "Bearbeiten")}
                                        </Link>
                                        {" / "}
                                        <button
                                            type="button"
                                            data-testid={`delete-item-${item.id}`}
                                            onClick={() => handleDelete(item.id, item.content)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--danger)",
                                                cursor: "pointer",
                                                padding: 0,
                                            }}
                                        >
                                            {t("topos.common.delete", "Löschen")}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.data.length === 0 && !items.loading && (
                                <tr>
                                    <td colSpan={4} style={{padding: "1rem", color: "var(--text-secondary)"}}>
                                        {t(
                                            "topos.page.container_detail.empty",
                                            "Keine Einträge in diesem Container.",
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>
            </main>
        </>
    );
}
