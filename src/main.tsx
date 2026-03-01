import React, { Component, StrictMode } from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./AppShell";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./styles/globals.css";
import "xterm/css/xterm.css";

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
      return (
        <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
          <div
            style={{
              border: "1px solid rgba(255,0,0,0.35)",
              background: "rgba(255,0,0,0.08)",
              padding: 16,
              borderRadius: 12,
              color: "#ff6b6b",
            }}
          >
            App crashed: {msg}
          </div>
          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            Check the devtools console for the full error. Restart the app after fixing the cause.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

window.addEventListener("unhandledrejection", (event) => {
  // Avoid a silent white-screen if a promise rejection escapes React.
  console.error("Unhandled promise rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  </StrictMode>,
);
