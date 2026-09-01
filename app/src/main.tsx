import { createRoot } from "react-dom/client";
import { WillaShell } from "willa";
import "willa/style.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <WillaShell theme="dark">
    <App />
  </WillaShell>,
);
