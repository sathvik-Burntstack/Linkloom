/* Razorpay Checkout for escrow payments.

   Flow (the secret key lives only on the backend):
   1. POST /v1/checkout/ { orderId }            → backend creates a Razorpay order for that deal's agreed price
      ← { razorpayOrderId, amount (paise), currency, keyId? }
   2. Razorpay Checkout opens in the page with that order id; the brand pays (UPI, card, net banking).
   3. POST /v1/payments/verify/ { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
      → backend checks the signature with the secret key and marks the deal funded.
   The backend's Razorpay webhook (payment.captured) is the source of truth if the browser closes before step 3.

   Field names are read leniently (camelCase or Razorpay's snake_case) until the backend contract is final. */
import { api, ApiError } from "../api/client";

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const ENV_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

let loading = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!loading)
    loading = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        loading = null;
        s.remove();
        fail(
          new ApiError(
            0,
            "The payment window couldn't load. Check your connection and try again.",
            "NETWORK",
          ),
        );
      };
      document.head.appendChild(s);
    });
  return loading;
}

/** What the payment ended in. "dismissed" = the brand closed the window; nothing was charged. */

/** Thrown when the backend has no checkout for this deal yet (endpoint missing or not switched on). */
export const PAYMENTS_OFF = "PAYMENTS_OFF";

const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return String(o[k]);
  return "";
};

export async function payForOrder(o) {
  /* the order first: if the backend refuses, no window opens */
  let co;
  try {
    co = await api("/v1/checkout/", { method: "POST", body: { orderId: o.orderId } });
  } catch (e) {
    if (
      e instanceof ApiError &&
      (e.status === 404 ||
        e.status === 501 ||
        e.code === "NOT_IMPLEMENTED" ||
        e.code === "PAYMENTS_NOT_CONFIGURED")
    )
      throw new ApiError(e.status, "Online payment isn't switched on yet.", PAYMENTS_OFF);
    throw e;
  }
  const nested = co.razorpay && typeof co.razorpay === "object" ? co.razorpay : {};
  const rzpOrder =
    pick(co, "razorpayOrderId", "razorpay_order_id", "providerOrderId") ||
    pick(nested, "orderId", "order_id", "id");
  const key = pick(co, "keyId", "key_id", "key") || pick(nested, "keyId", "key_id", "key") || ENV_KEY;
  const amount = Number(pick(co, "amount", "amountPaise") || pick(nested, "amount")) || undefined;
  const currency = pick(co, "currency") || pick(nested, "currency") || "INR";
  if (!rzpOrder || !key)
    throw new ApiError(
      0,
      "The payment couldn't be started. Please try again in a minute.",
      "CHECKOUT_INCOMPLETE",
    );

  await loadCheckout();
  const Rzp = window.Razorpay;
  const paid = await new Promise(done => {
    let settled = false;
    const finish = r => {
      if (!settled) {
        settled = true;
        done(r);
      }
    };
    /* a failed attempt keeps the window open so the brand can retry; it is reported only if they then close it */
    let lastFail = "";
    const rzp = new Rzp({
      key,
      order_id: rzpOrder,
      ...(amount ? { amount } : {}),
      currency,
      name: "Linkloom",
      description: o.description.slice(0, 250),
      prefill: o.prefill || {},
      notes: { linkloomOrderId: o.orderId },
      theme: { color: "#121212" },
      handler: r => finish(r),
      modal: {
        ondismiss: () => finish(lastFail ? { status: "failed", message: lastFail } : { status: "dismissed" }),
        confirm_close: true,
      },
    });
    rzp.on("payment.failed", r => {
      lastFail = r.error?.description || r.error?.reason || "The payment didn't go through.";
    });
    rzp.open();
  });
  if ("status" in paid) return paid;

  /* the backend checks the signature with the secret key and marks the deal funded */
  await api("/v1/payments/verify/", {
    method: "POST",
    body: {
      orderId: o.orderId,
      razorpayOrderId: paid.razorpay_order_id,
      razorpayPaymentId: paid.razorpay_payment_id,
      razorpaySignature: paid.razorpay_signature,
    },
  });
  return { status: "paid", paymentId: paid.razorpay_payment_id };
}
