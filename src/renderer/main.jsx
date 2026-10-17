import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { createWebBridge } from "./web-bridge.js";

if (!window.desktop) {
  window.desktop = createWebBridge();
}

document.documentElement.dataset.platform =
  window.desktop.platform ?? "electron";

if (window.desktop.platform === "web" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const root = document.getElementById("root");
if (!root) throw new Error("未找到应用挂载节点");
createRoot(root).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
