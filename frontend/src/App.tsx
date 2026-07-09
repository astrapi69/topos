import {useEffect} from "react";
import {Route, Routes} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {DialogProvider} from "./components/AppDialog";
import DemoSeeder from "./components/DemoSeeder";
import ErrorReportDialog from "./components/ErrorReportDialog";
import OfflineBanner from "./components/OfflineBanner";
import PwaPrompts from "./components/PwaPrompts";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";
import {rebuildSearchIndex} from "./search/buildIndex";

import Actions from "./pages/Actions";
import CategoryBrowse from "./pages/CategoryBrowse";
import ContainerDetail from "./pages/ContainerDetail";
import ContainerList from "./pages/ContainerList";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import ItemEditor from "./pages/ItemEditor";
import PhotoIntake from "./pages/PhotoIntake";
import Settings from "./pages/Settings";

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
            <DialogProvider>
                <OfflineBanner />
                <DemoSeeder />
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
                <ToastContainer
                    position="bottom-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnHover
                    theme="colored"
                />
                <PwaPrompts />
                <ErrorReportDialog />
            </DialogProvider>
        </I18nProvider>
    );
}
