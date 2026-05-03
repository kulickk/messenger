import { createRoot } from "react-dom/client";
import App from "./components/App/App.jsx";
import { StrictMode } from "react";

const domNode = document.getElementById("app");
const root = createRoot(domNode);
root.render(
    <StrictMode>
        <App />
    </StrictMode>,
);
