/* part: steps */
/* Steps v5: all six cards in one grid (3 × 2 on desktop), no carousel,
   illustration loops only on hover or focus (once on entry for touch), one entrance for the grid. */
(() => {
  const L = window.LL;
  if (!L) return;
  const { $, $$, RM, hasG } = L;
  const root = $("#how");
  if (!root) return;
  const rail = $(".st-rail", root),
    cards = $$(".st-card", root);

  /* payout slip numbers come from the shared helper (no per-deal platform fee) */
  const pay = L.payout(18000);
  $$("[data-st-pay]", root).forEach(el => {
    const k = el.dataset.stPay;
    el.textContent = (k === "fee" ? "−" : "") + L.inr(pay[k]);
  });
  const feeNote = $(".st-slip em", root);
  if (feeNote && L.FEE_RATE) feeNote.textContent = Math.round(L.FEE_RATE * 100) + "% in this example";

  /* illustration loops: play while hovered or focused (desktop) or once on entry (touch),
     and stop only at a moment where the loop matches the still pose, so nothing snaps. */
  const REST = [
    [
      [0, 0.02],
      [0.43, 0.45],
      [0.985, 1],
    ],
    [[0.45, 0.81]],
    [
      [0, 0.27],
      [0.55, 1],
    ],
    [
      [0.23, 0.27],
      [0.73, 0.77],
    ],
    [
      [0, 0.13],
      [0.38, 1],
    ],
    [
      [0, 0.02],
      [0.985, 1],
    ],
  ];
  const ONCE = [5900, 4800, 5900, 4500, 5900, 5900];
  const stageOf = c => $(".st-stage", c);
  const play = c => {
    if (RM) return;
    clearTimeout(c._stop);
    stageOf(c).classList.add("play");
  };
  const stop = c => {
    const s = stageOf(c);
    clearTimeout(c._stop);
    if (!s.classList.contains("play")) return;
    const a = s.getAnimations ? s.getAnimations({ subtree: true })[0] : null;
    if (!a || a.currentTime == null) {
      s.classList.remove("play");
      return;
    }
    const t = (a.currentTime % 6000) / 6000,
      w = REST[cards.indexOf(c)];
    if (w.some(([x, y]) => t >= x && t <= y)) {
      s.classList.remove("play");
      return;
    }
    const wait = Math.min(...w.map(([x]) => (x - t + 1) % 1));
    c._stop = setTimeout(() => s.classList.remove("play"), wait * 6000 + 30);
  };
  if (!RM) {
    if (L.fine) {
      cards.forEach(c => {
        c.addEventListener("pointerenter", e => {
          if (e.pointerType !== "touch") play(c);
        });
        c.addEventListener("pointerleave", e => {
          if (e.pointerType !== "touch") stop(c);
        });
        c.addEventListener("focus", () => play(c));
        c.addEventListener("blur", () => stop(c));
      });
    } else if (window.IntersectionObserver) {
      const io = new IntersectionObserver(
        es =>
          es.forEach(e => {
            if (!e.isIntersecting) return;
            const c = e.target;
            io.unobserve(c);
            play(c);
            c._stop = setTimeout(() => stop(c), ONCE[cards.indexOf(c)]);
          }),
        { threshold: 0.65 },
      );
      cards.forEach(c => io.observe(c));
    }
  }

  /* one entrance for the section body: the cards rise in, row by row */
  L.ready.push(() => {
    if (!hasG || RM) return;
    L.G.from(cards, {
      y: 48,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.07,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: rail, start: "top 88%", once: true },
    });
  });
})();
