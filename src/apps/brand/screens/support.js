/* Help & support for brands: the shared screens (src/shared/support) with this app's deals. */
import { installSupport } from "@/shared/support/screen";

const S = () => window.LLD_DATA;
installSupport({
  deals: () =>
    (S().campaigns || [])
      .filter(c => !String(c.id).startsWith("offer-"))
      .map(c => ({
        id: String(c.id),
        title: c.title || "Deal",
        sub: ((S().creators || []).find(k => k.id === c.creator) || {}).name || "",
      })),
  dealHref: id => "#campaign-" + id,
});
