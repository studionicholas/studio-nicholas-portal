import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ClientPortal.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker (makes the app installable + ready for notifications).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker registration failed", err));
  });
}
