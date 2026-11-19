/* Landing page entry. React draws the page (page.jsx) into <body>; then the section parts load in the original page's
   script order (each reads helpers from window.LL) and boot their motion and widgets on that markup. */
import "./landing.css";
import "../../shared/analytics";
import "./vendor";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Page } from "./page";

flushSync(() => createRoot(document.body).render(<Page />));

(async () => {
  await import("./core");
  await import("./hero");
  await import("./steps");
  await import("./sides");
  await import("./trust");
  await import("./platforms");
  await import("./cta");
  await import("./footer");
  window.LL.boot();
})();
