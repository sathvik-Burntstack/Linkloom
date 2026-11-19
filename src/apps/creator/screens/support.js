/* Help & support for creators: the shared screens (src/shared/support) with this app's deals. */
import { installSupport } from "@/shared/support/screen";

installSupport({
  deals: () =>
    (window.LLD.store.s.active || []).map(a => ({
      id: String(a.id),
      title: a.title || "Deal",
      sub: a.brand || "",
    })),
  dealHref: id => "#work-" + id,
});
