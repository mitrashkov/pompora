import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./AppShell";
import "@fontsource/geist-sans";
import "@fontsource/geist-mono";
import "@fontsource/jetbrains-mono";
import "./styles/globals.css";
import "xterm/css/xterm.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
