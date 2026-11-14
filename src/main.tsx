import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha silenciosa em ambientes que bloqueiam SW (ex.: modo privado)
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
