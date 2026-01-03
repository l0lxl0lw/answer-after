import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// System preference theme detection
const updateTheme = () => {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("light", !isDark);
};
updateTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", updateTheme);

createRoot(document.getElementById("root")!).render(<App />);
