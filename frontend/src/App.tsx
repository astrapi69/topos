import {Route, Routes} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {DialogProvider} from "./components/AppDialog";
import {I18nProvider} from "./hooks/useI18n";
import {useTheme} from "./hooks/useTheme";

import Actions from "./pages/Actions";
import CategoryBrowse from "./pages/CategoryBrowse";
import ContainerDetail from "./pages/ContainerDetail";
import ContainerList from "./pages/ContainerList";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import ItemEditor from "./pages/ItemEditor";
import Settings from "./pages/Settings";

export default function App() {
    useTheme();

    return (
        <I18nProvider>
            <DialogProvider>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/containers" element={<ContainerList />} />
                    <Route path="/containers/:id" element={<ContainerDetail />} />
                    <Route path="/items/new" element={<ItemEditor />} />
                    <Route path="/items/:id" element={<ItemEditor />} />
                    <Route path="/categories" element={<CategoryBrowse />} />
                    <Route path="/actions" element={<Actions />} />
                    <Route path="/import" element={<Import />} />
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
            </DialogProvider>
        </I18nProvider>
    );
}
