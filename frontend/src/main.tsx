import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import { verifyBackendVersion } from "./utils/versionCheck";

if (import.meta.env.DEV) {
  void import("@axe-core/react").then((mod) => {
    mod.default(React, ReactDOM, 1000);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

void verifyBackendVersion();
