import {Suspense, useEffect} from "react";
import {Route, Routes} from "react-router-dom";
import {RefreshCw} from "lucide-react";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {UpdateBanner} from "@astrapi69/pwa-update-react";

import AppUpdateProvider from "./components/AppUpdateProvider";
import AppFeatureProvider from "./features/AppFeatureProvider";
import {DialogProvider} from "./components/AppDialog";
import DemoSeeder from "./components/DemoSeeder";
import ErrorReportDialog from "./components/ErrorReportDialog";
import OfflineBanner from "./components/OfflineBanner";
import PwaPrompts from "./components/PwaPrompts";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";
import {lazyWithReload} from "./pwa/lazy-route";
import {rebuildSearchIndex} from "./search/buildIndex";

// Routes are code-split and wrapped with lazyWithReload so a stale GitHub
// Pages deploy (old index.html referencing gone chunk files) recovers with
// a single guarded reload instead of a blank route.
const Actions = lazyWithReload(() => import("./pages/Actions"));
const CategoryBrowse = lazyWithReload(() => import("./pages/CategoryBrowse"));
const ContainerDetail = lazyWithReload(() => import("./pages/ContainerDetail"));
const ContainerList = lazyWithReload(() => import("./pages/ContainerList"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Import = lazyWithReload(() => import("./pages/Import"));
const ItemEditor = lazyWithReload(() => import("./pages/ItemEditor"));
const PhotoIntake = lazyWithReload(() => import("./pages/PhotoIntake"));
const Settings = lazyWithReload(() => import("./pages/Settings"));

export default function App() {
    useTheme();

    // Build the search index on app start from whatever is already cached
    // in Dexie (instant + offline-capable). Pages refresh the cache and
    // rebuild as fresh data arrives.
    useEffect(() => {
        void rebuildSearchIndex();
    }, []);

    return (
        <I18nProvider>
            <AppUpdateProvider>
                <AppFeatureProvider>
                    <DialogProvider>
                        <OfflineBanner />
                        <DemoSeeder />
                        <Suspense fallback={null}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/containers" element={<ContainerList />} />
                                <Route path="/containers/:id" element={<ContainerDetail />} />
                                <Route path="/items/new" element={<ItemEditor />} />
                                <Route path="/items/:id" element={<ItemEditor />} />
                                <Route path="/categories" element={<CategoryBrowse />} />
                                <Route path="/actions" element={<Actions />} />
                                <Route path="/import" element={<Import />} />
                                <Route path="/photo-intake" element={<PhotoIntake />} />
                                <Route path="/settings" element={<Settings />} />
                            </Routes>
                        </Suspense>
                        <ToastContainer
                            position="bottom-right"
                            autoClose={3000}
                            hideProgressBar={false}
                            newestOnTop
                            closeOnClick
                            pauseOnHover
                            theme="colored"
                        />
                        <UpdateBanner icon={<RefreshCw size={16} aria-hidden />} />
                        <PwaPrompts />
                        <ErrorReportDialog />
                    </DialogProvider>
                </AppFeatureProvider>
            </AppUpdateProvider>
        </I18nProvider>
    );
}
