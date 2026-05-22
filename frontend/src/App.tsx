import {Routes, Route} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {DialogProvider} from "./components/AppDialog";
import {useTheme} from "./hooks/useTheme";
import {I18nProvider} from "./hooks/useI18n";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

export default function App() {
    useTheme();

    return (
        <I18nProvider>
            <DialogProvider>
                <Routes>
                    <Route path="/" element={<Dashboard/>}/>
                    <Route path="/settings" element={<Settings/>}/>
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
