import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import Calculator from "@/components/calc/Calculator";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="min-h-screen bg-background text-foreground antialiased">
      <Calculator />
    </main>
  </StrictMode>,
);
