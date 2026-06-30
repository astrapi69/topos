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
    {/*
      basename matches the Vite base path so routes resolve under the
      GitHub Pages subpath (/topos/) as well as at root (make dev).
      Without it, /topos/ matches no route and only the outside-Routes
      offline banner renders. import.meta.env.BASE_URL is "/topos/" in the
      GitHub Pages build, "/" otherwise.
    */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

void verifyBackendVersion();
