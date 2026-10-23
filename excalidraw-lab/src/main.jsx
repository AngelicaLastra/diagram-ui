import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

/* No StrictMode: its double-mount fights Excalidraw's imperative API handle. */
createRoot(document.getElementById("root")).render(<App />);
