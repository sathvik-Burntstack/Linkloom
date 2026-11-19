/* Brand dashboard entry. Import order is the prototype's order. Mechanical port: still uses window.LLD like the original. */
import "../../shared/analytics";
import "./core.css";
import "../../shared/layout.css"; // F1 tokens and the shared .ll-* pieces, after core.css on purpose
import "./motion.css";
import "./screens/auth.css";
import "./screens/profile.css";
import "./screens/home.css";
import "./screens/creators.css";
import "./screens/creator.css";
import "./screens/cart.css";
import "./screens/jobs.css";
import "./screens/post.css";
import "./screens/job.css";
import "./screens/pitches.css";
import "./screens/campaigns.css";
import "./screens/messages.css";
import "./screens/payments.css";
import "./screens/reports.css";
import "../../shared/support/support.css";
import "./chrome.css";
import "../../shared/vendor-gsap";
import "./seed";
import "./core";
import "./select";
import "../../shared/motion";
import "../../shared/datepicker"; // themed calendar on every date field
import "./screens/auth";
import "./screens/profile";
import "./screens/home";
import "./screens/creators";
import "./screens/creator";
import "./screens/cart";
import "./screens/jobs"; // the brand kit (LLD.bk)
import "./screens/jobs-list";
import "./screens/post";
import "./screens/job";
import "./screens/pitches";
import "./screens/campaigns";
import "./screens/messages";
import "./screens/payments";
import "./screens/reports";
import "./screens/support";
import { initBrandSession } from "./session";

const w = window;
const ready = initBrandSession();
if (ready === true) w.LLD.boot();
else if (ready) void ready.then(ok => ok && w.LLD.boot());
