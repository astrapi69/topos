import {useI18n} from "../hooks/useI18n";

export default function Dashboard() {
    const {t} = useI18n();
    return (
        <main>
            <h1>{t("topos.app.name", "Topos")}</h1>
            <p>{t("topos.app.description", "Personal inventory tracker")}</p>
        </main>
    );
}
