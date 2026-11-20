/* The landing page's markup, as React components (converted from the static index.html). The sections' motion and
   widgets (core.js and the section files) run on it once it is drawn; see main.jsx. */

function Hero() {
  return (
    <>
      {/* ── part: hero ── */}{" "}
      {/* Hero: P2 stripe shader, blur-rise headline with the inline ring pill, sub copy, two buttons */}{" "}
      <section className="sec dark hx" id="hero" aria-labelledby="hxH">
        {" "}
        <canvas className="hx-bg" aria-hidden="true"></canvas>{" "}
        <div className="hx-fb" aria-hidden="true"></div>{" "}
        <div className="in hx-in">
          {" "}
          <h1 className="hx-h" id="hxH" data-reveal="now" data-reveal-delay=".2">
            Creators and
            <br className="hx-bm" /> brands
            <br className="hx-bd" />{" "}
            <span className="hx-pill" aria-hidden="true">
              <span className="hx-knot">
                <i className="hx-r hx-rc"></i>
                <i className="hx-r hx-rv"></i>
                <i className="hx-r hx-rc hx-rc2"></i>
              </span>
            </span>
            <br className="hx-bm" /> weave work
            <br /> that pays.
          </h1>{" "}
          <div className="hx-foot" data-hx-in>
            {" "}
            <p className="hx-sub">
              Brands post a collab. Creators bid in a minute. Escrow holds the money until the work is
              approved.
            </p>{" "}
            <div className="hx-ctas">
              {" "}
              <a className="lq lq-p lq-coral" href="signin.html?join=1&role=creator">
                Find brand deals
              </a>{" "}
              <a className="lq lq-p lq-violet" href="signin.html?join=1&role=brand">
                Hire creators
              </a>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

function How() {
  return (
    <>
      {/* ── part: steps ── */}{" "}
      {/* Steps (v5): header row + all six cards in a 3 × 2 grid (no sideways scroll). No sticky column, no thread. */}{" "}
      <section className="sec dark st" id="how" aria-labelledby="stH">
        {" "}
        <div className="in st-in">
          {" "}
          <h2 className="st-h" id="stH" data-reveal>
            From posting to payout.
          </h2>{" "}
          <div className="st-lede">
            {" "}
            <p className="st-sub">
              Six steps, one shared timeline. Creator and brand see the same deal, from the first collab to the
              final payout.
            </p>{" "}
            <p className="sample">Mirevo, Ananya and the amounts shown are samples.</p>{" "}
          </div>{" "}
          <div className="st-railbox">
            {" "}
            <ol className="st-rail" id="stRail" aria-label="The six steps of a deal">
              {" "}
              <li className="st-card" tabIndex="0" aria-labelledby="st-t1">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art m-envelope">
                        <img
                          className="full"
                          src="assets/step-01-envelope.svg"
                          width="300"
                          height="220"
                          alt=""
                        />
                      </div>
                    </div>
                  </div>{" "}
                  <div className="st-ui st-fields" role="group" aria-label="Collab">
                    {" "}
                    <p>
                      <span>Budget</span>
                      <b>₹18,000</b>
                    </p>{" "}
                    <p>
                      <span>Platform</span>
                      <b>Reel</b>
                    </p>{" "}
                    <p>
                      <span>Deadline</span>
                      <b>12 Dec</b>
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <p className="st-n">01</p>{" "}
                <h3 className="st-tt" id="st-t1">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Post a collab</span>
                </h3>{" "}
                <p className="st-tx">
                  Set the budget, platform and deadline. Or skip the wait and invite a creator directly.
                </p>{" "}
              </li>{" "}
              <li className="st-card" tabIndex="0" aria-labelledby="st-t2">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art">
                        {" "}
                        <div className="p-trail m-trail">
                          <img src="assets/step-02-trail.svg" width="163" height="101" alt="" />
                        </div>{" "}
                        <div className="p-plane m-plane">
                          <img src="assets/step-02-plane.svg" width="72" height="72" alt="" />
                        </div>{" "}
                        <div className="p-chip m-chip">
                          <img className="bg" src="assets/step-02-chip.svg" width="112" height="36" alt="" />
                          <div className="rupee">
                            <img src="assets/step-02-chip-rupee.svg" width="14" height="18" alt="" />
                          </div>
                          <span className="amt">18,000</span>
                        </div>{" "}
                      </div>
                    </div>
                  </div>{" "}
                  <div className="st-ui st-fields" role="group" aria-label="Bid">
                    {" "}
                    <p>
                      <span>Post date</span>
                      <b>12 Dec</b>
                    </p>{" "}
                    <p>
                      <span>Past work</span>
                      <b>3 links</b>
                    </p>{" "}
                    <span className="st-pill">Send bid</span>{" "}
                  </div>{" "}
                </div>{" "}
                <p className="st-n">02</p>{" "}
                <h3 className="st-tt" id="st-t2">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Bid in a minute</span>
                </h3>{" "}
                <p className="st-tx">
                  Creators send a price, a post date and past work. ID is checked once, at the first bid.
                </p>{" "}
              </li>{" "}
              <li className="st-card" tabIndex="0" aria-labelledby="st-t3">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art m-lock">
                        <img className="full" src="assets/step-03-lock.svg" width="300" height="220" alt="" />
                      </div>
                    </div>
                  </div>{" "}
                  <div className="st-ui st-split" role="group" aria-label="Escrow">
                    {" "}
                    <p className="st-amt">₹18,000</p> <span className="st-held">Held by Linkloom</span>{" "}
                  </div>{" "}
                </div>{" "}
                <p className="st-n">03</p>{" "}
                <h3 className="st-tt" id="st-t3">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Lock it in escrow</span>
                </h3>{" "}
                <p className="st-tx">
                  The brand pays in, Linkloom holds it, and chat unlocks for both sides.
                </p>{" "}
              </li>{" "}
              <li className="st-card" tabIndex="0" aria-labelledby="st-t4">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art m-orbit">
                        <img
                          className="full"
                          src="assets/step-04-orbit.svg"
                          width="300"
                          height="220"
                          alt=""
                        />
                      </div>
                    </div>
                  </div>{" "}
                  <ol className="st-ui st-track" aria-label="Deal stages">
                    {" "}
                    <li className="is-done">Kickoff</li> <li className="is-done">Upload</li>{" "}
                    <li className="is-now" aria-current="step">
                      Review
                    </li>{" "}
                  </ol>{" "}
                </div>{" "}
                <p className="st-n">04</p>{" "}
                <h3 className="st-tt" id="st-t4">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Create</span>
                </h3>{" "}
                <p className="st-tx">
                  Kickoff, upload, review. Every stage tracked in one place, with chat alongside.
                </p>{" "}
              </li>{" "}
              <li className="st-card" tabIndex="0" aria-labelledby="st-t5">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art m-stamp">
                        <img
                          className="full"
                          src="assets/step-05-stamp.svg"
                          width="300"
                          height="220"
                          alt=""
                        />
                      </div>
                    </div>
                  </div>{" "}
                  <div className="st-ui st-acts" role="group" aria-label="Review">
                    {" "}
                    <span className="st-pill">Approve</span>{" "}
                    <span className="st-pill st-pill-o">Ask for a revision</span>{" "}
                  </div>{" "}
                </div>{" "}
                <p className="st-n">05</p>{" "}
                <h3 className="st-tt" id="st-t5">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Sign it off</span>
                </h3>{" "}
                <p className="st-tx">
                  Approve the work or ask for a revision. The money stays put until you do.
                </p>{" "}
              </li>{" "}
              <li className="st-card st-pay" tabIndex="0" aria-labelledby="st-t6">
                {" "}
                <div className="st-stage">
                  {" "}
                  <div className="st-art" aria-hidden="true">
                    <div className="st-fit">
                      <div className="art m-coins">
                        <img
                          className="full"
                          src="assets/step-06-coins.svg"
                          width="300"
                          height="220"
                          alt=""
                        />
                      </div>
                    </div>
                  </div>{" "}
                  <div className="st-ui st-slip" role="group" aria-label="Payout slip">
                    {" "}
                    <p className="st-row">
                      <span>Platform fee</span>
                      <b>None, Linkloom is a subscription</b>
                    </p>{" "}
                    <p className="st-row">
                      <span>Tax / withholding</span>
                      <b>As per confirmed rules</b>
                    </p>{" "}
                    <p className="st-row st-recv">
                      <span>You receive</span>
                      <b>
                        <span data-st-pay="net">₹18,000</span>
                        <small> − tax</small>
                      </b>
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <p className="st-n">06</p>{" "}
                <h3 className="st-tt" id="st-t6">
                  <svg className="st-ar" viewBox="0 0 40 16" aria-hidden="true">
                    <path d="M1 8h37M31 1.5 38 8l-7 6.5" />
                  </svg>
                  <span>Get paid</span>
                </h3>{" "}
                <p className="st-tx">
                  Funds release to UPI or bank: the full agreed price, no platform fee.
                </p>{" "}
              </li>{" "}
            </ol>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

function Sides() {
  return (
    <>
      {/* ── part: sides ── */}{" "}
      <section className="sec sd light" id="sides" data-side="creator" aria-labelledby="sdH">
        {" "}
        {/* 1. Entrance: funkhaus P13 colour flip. The ink layer holds the real heading; the paper layer is a
       duplicate whose clip-path edge is scrubbed upward, so the headline repaints exactly along that edge. */}{" "}
        <div className="sd-flip">
          {" "}
          <div className="sd-pin">
            {" "}
            <div className="sd-lay sd-lay-ink">
              {" "}
              <div className="sd-hw">
                {" "}
                <p className="eyebrow sd-eb0">Two sides</p>{" "}
                <h2 className="sd-hl" id="sdH">
                  <span className="sd-l">
                    One deal.{" "}
                    <span className="sd-ip" aria-hidden="true">
                      <img className="sd-ipc" src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      <img className="sd-ipb" src="assets/dot-brand.svg" width="10" height="10" alt="" />
                    </span>
                  </span>{" "}
                  <span className="sd-l">Two sides.</span>
                  <br className="sd-br" /> Nobody chasing payments.
                </h2>{" "}
              </div>{" "}
            </div>{" "}
            <div className="sd-lay sd-lay-paper" aria-hidden="true">
              {" "}
              <div className="sd-hw">
                {" "}
                <p className="eyebrow sd-eb0">Two sides</p>{" "}
                <p className="sd-hl">
                  <span className="sd-l">
                    One deal.{" "}
                    <span className="sd-ip">
                      <img className="sd-ipc" src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      <img className="sd-ipb" src="assets/dot-brand.svg" width="10" height="10" alt="" />
                    </span>
                  </span>{" "}
                  <span className="sd-l">Two sides.</span>
                  <br className="sd-br" /> Nobody chasing payments.
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <i className="sd-edge" aria-hidden="true"></i>{" "}
            <i className="sd-hdrmark" data-hdr="light" aria-hidden="true"></i>{" "}
            <div className="sd-float sd-float-c" aria-hidden="true">
              {" "}
              <div className="sd-fl-top">
                <p className="sd-fl-eb">Creator side</p>
                <span className="sd-fl-ic">
                  <img src="assets/icon-instagram.svg" width="22" height="22" alt="" />
                </span>
              </div>{" "}
              <div>
                <p className="sd-fl-lb">Your bid</p>
                <p className="sd-fl-amt">₹18,000</p>
              </div>{" "}
              <div className="sd-fl-bot">
                <span>Mirevo Skincare</span>
                <span className="sample">Sample</span>
              </div>{" "}
            </div>{" "}
            <div className="sd-float sd-float-b" aria-hidden="true">
              {" "}
              <div className="sd-fl-top">
                <p className="sd-fl-eb">Brand side</p>
                <span className="sd-fl-ic">
                  <i className="sd-lock"></i>
                </span>
              </div>{" "}
              <div>
                <p className="sd-fl-lb">Into escrow</p>
                <p className="sd-fl-amt">₹18,000</p>
              </div>{" "}
              <div className="sd-fl-bot">
                <span>Released on approval</span>
                <span className="sample">Sample</span>
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        {/* 2. Deal stage on paper: one deal card, two faces */}{" "}
        <div className="sd-deal" id="sdDeal" data-hdr="light">
          {" "}
          <div className="sd-in">
            {" "}
            <div className="sd-switch" role="tablist" aria-label="Show the deal as">
              {" "}
              <span className="sd-thumb" aria-hidden="true"></span>{" "}
              <button
                className="sd-tab"
                type="button"
                role="tab"
                id="sdTabC"
                aria-controls="sdStage"
                aria-selected="true"
                data-s="creator"
              >
                I'm a creator
              </button>{" "}
              <button
                className="sd-tab"
                type="button"
                role="tab"
                id="sdTabB"
                aria-controls="sdStage"
                aria-selected="false"
                tabIndex="-1"
                data-s="brand"
              >
                I'm a brand
              </button>{" "}
            </div>{" "}
            <div className="sd-stage" id="sdStage" role="tabpanel" aria-labelledby="sdTabC">
              {" "}
              <div className="sd-flood" aria-hidden="true">
                <i className="sd-fld sd-fld-c"></i>
                <i className="sd-fld sd-fld-b"></i>
              </div>{" "}
              <div className="sd-copy">
                {" "}
                <div className="sd-side" data-for="creator">
                  {" "}
                  <p className="eyebrow sd-eb">For creators</p>{" "}
                  <h3 className="sd-h3">Brand deals, paid on time.</h3>{" "}
                  <ul className="sd-feats">
                    {" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      </span>
                      Collabs matched to your niche, city and language
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      </span>
                      ID checked once, never shown to brands
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      </span>
                      Every deal stage and chat in one place
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                      </span>
                      Withdraw to UPI or bank, the full agreed price
                    </li>{" "}
                  </ul>{" "}
                  <a className="lq lq-p sd-cta" href="app.html#home">
                    Join as a creator
                  </a>{" "}
                </div>{" "}
                <div className="sd-side sd-off" data-for="brand" inert aria-hidden="true">
                  {" "}
                  <p className="eyebrow sd-eb">For brands</p>{" "}
                  <h3 className="sd-h3">Right creator. Safe payment.</h3>{" "}
                  <ul className="sd-feats">
                    {" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-brand.svg" width="10" height="10" alt="" />
                      </span>
                      Filter by niche, city, language, followers and price
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-brand.svg" width="10" height="10" alt="" />
                      </span>
                      Hire directly, or post a collab and compare bids
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-brand.svg" width="10" height="10" alt="" />
                      </span>
                      Pay into escrow. Release only on approval
                    </li>{" "}
                    <li>
                      <span className="sd-dot">
                        <img src="assets/dot-brand.svg" width="10" height="10" alt="" />
                      </span>
                      Reports on spend, views and every creator
                    </li>{" "}
                  </ul>{" "}
                  <a className="lq lq-p sd-cta" href="brand.html#home">
                    Start hiring
                  </a>{" "}
                </div>{" "}
              </div>{" "}
              <div className="sd-right">
                {" "}
                <div className="sd-card">
                  {" "}
                  <div className="sd-card-in">
                    {" "}
                    {/* front: the creator sees the brief and bids */}{" "}
                    <article className="sd-face sd-front" aria-label="Sample collab from Mirevo Skincare">
                      {" "}
                      <div className="sd-fh">
                        {" "}
                        <span className="sd-src">
                          <img src="assets/icon-instagram.svg" width="20" height="20" alt="" />
                          Mirevo Skincare · Instagram
                        </span>{" "}
                        <span className="sample">Sample</span>{" "}
                      </div>{" "}
                      <h4 className="sd-title">Barrier Repair Serum launch</h4>{" "}
                      <p className="sd-meta">1 Reel · Budget ₹18,000</p>{" "}
                      <ul className="sd-tags" aria-label="Collab matches your profile">
                        {" "}
                        <li>
                          <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                          Skincare
                        </li>{" "}
                        <li>
                          <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                          Mumbai
                        </li>{" "}
                        <li>
                          <img src="assets/dot-creator.svg" width="10" height="10" alt="" />
                          Hindi or English
                        </li>{" "}
                      </ul>{" "}
                      <div className="sd-bid">
                        {" "}
                        <label className="sd-lab" htmlFor="sdBid">
                          Your bid
                        </label>{" "}
                        <div className="sd-field">
                          {" "}
                          <span className="sd-cur" aria-hidden="true">
                            ₹
                          </span>{" "}
                          <input
                            className="sd-in-bid"
                            id="sdBid"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength="9"
                            defaultValue="18,000"
                            aria-describedby="sdNet sdFine"
                          />{" "}
                          <button
                            className="sd-step"
                            type="button"
                            data-step="-500"
                            aria-label="Lower bid by ₹500"
                          >
                            −
                          </button>{" "}
                          <button
                            className="sd-step"
                            type="button"
                            data-step="500"
                            aria-label="Raise bid by ₹500"
                          >
                            +
                          </button>{" "}
                        </div>{" "}
                        <p className="sd-net" id="sdNet">
                          You'd receive <b id="sdNetV">₹18,000</b> − tax{" "}
                          <span className="sd-ex">(the agreed price, no platform fee)</span>
                        </p>{" "}
                        <p className="sd-fine" id="sdFine">
                          No platform fee<span id="sdFeeV" hidden></span>. Tax as per confirmed rules.
                        </p>{" "}
                      </div>{" "}
                      <div className="sd-act">
                        {" "}
                        <button className="lq lq-p sd-send" id="sdSend" type="button">
                          Send bid
                        </button>{" "}
                        <span className="sd-chip" id="sdChip" data-tone="draft">
                          <span>Draft</span>
                        </span>{" "}
                      </div>{" "}
                      <p className="sd-next" id="sdNext">
                        Next: Mirevo compares bids and pays the one it accepts into escrow.
                      </p>{" "}
                    </article>{" "}
                    {/* back: the brand compares bids on the same brief */}{" "}
                    <article className="sd-face sd-back" aria-label="Sample bids on the Mirevo collab" inert>
                      {" "}
                      <div className="sd-fh">
                        {" "}
                        <span className="sd-src">Bids on your collab</span>{" "}
                        <span className="sample">Sample</span>{" "}
                      </div>{" "}
                      <h4 className="sd-title">Barrier Repair Serum launch</h4>{" "}
                      <div className="sd-sort" role="group" aria-label="Sort bids by">
                        {" "}
                        <span className="sd-lab" aria-hidden="true">
                          Sort
                        </span>{" "}
                        <button className="sd-sb" type="button" data-key="price" aria-pressed="false">
                          Price
                        </button>{" "}
                        <button className="sd-sb" type="button" data-key="eng" aria-pressed="true">
                          Engagement
                        </button>{" "}
                        <button className="sd-sb" type="button" data-key="fol" aria-pressed="false">
                          Followers
                        </button>{" "}
                      </div>{" "}
                      <ol className="sd-bids" id="sdBids">
                        {" "}
                        <li className="sd-row sd-pro" data-price="18000" data-eng="6.8" data-fol="182000">
                          {" "}
                          <span className="sd-av sd-av-c" aria-hidden="true">
                            AI
                          </span>{" "}
                          <div className="sd-who">
                            <b>Ananya Iyer</b>
                            <span>@ananyamakes · Mumbai · Skincare</span>
                          </div>{" "}
                          <b className="sd-price">₹18,000</b>{" "}
                          <div className="sd-stats">
                            <span>
                              <b>182K</b> Instagram
                            </span>
                            <span>
                              <b>41K</b> YouTube
                            </span>
                            <span>
                              <b>6.8%</b> Engagement
                            </span>
                          </div>{" "}
                          <button
                            className="sd-acc"
                            type="button"
                            aria-pressed="false"
                            data-name="Ananya Iyer"
                            data-price="18000"
                          >
                            <i className="sd-lock" aria-hidden="true"></i>
                            <span className="sd-acc-t">
                              <span>Accept</span>
                            </span>
                          </button>{" "}
                        </li>{" "}
                        <li className="sd-row" data-price="14500" data-eng="5.2" data-fol="96000">
                          {" "}
                          <span className="sd-av sd-av-b" aria-hidden="true">
                            KS
                          </span>{" "}
                          <div className="sd-who">
                            <b>Kabir Sethi</b>
                            <span>@kabirskinlab · Pune</span>
                          </div>{" "}
                          <b className="sd-price">₹14,500</b>{" "}
                          <div className="sd-stats">
                            <span>
                              <b>96K</b> Instagram
                            </span>
                            <span>
                              <b>5.2%</b> Engagement
                            </span>
                          </div>{" "}
                          <button
                            className="sd-acc"
                            type="button"
                            aria-pressed="false"
                            data-name="Kabir Sethi"
                            data-price="14500"
                          >
                            <i className="sd-lock" aria-hidden="true"></i>
                            <span className="sd-acc-t">
                              <span>Accept</span>
                            </span>
                          </button>{" "}
                        </li>{" "}
                        <li className="sd-row" data-price="24000" data-eng="4.1" data-fol="240000">
                          {" "}
                          <span className="sd-av sd-av-y" aria-hidden="true">
                            MP
                          </span>{" "}
                          <div className="sd-who">
                            <b>Meera Pillai</b>
                            <span>@meeraglows · Kochi</span>
                          </div>{" "}
                          <b className="sd-price">₹24,000</b>{" "}
                          <div className="sd-stats">
                            <span>
                              <b>240K</b> Instagram
                            </span>
                            <span>
                              <b>4.1%</b> Engagement
                            </span>
                          </div>{" "}
                          <button
                            className="sd-acc"
                            type="button"
                            aria-pressed="false"
                            data-name="Meera Pillai"
                            data-price="24000"
                          >
                            <i className="sd-lock" aria-hidden="true"></i>
                            <span className="sd-acc-t">
                              <span>Accept</span>
                            </span>
                          </button>{" "}
                        </li>{" "}
                      </ol>{" "}
                    </article>{" "}
                  </div>{" "}
                </div>{" "}
                <ul className="sd-bubbles" aria-hidden="true">
                  {" "}
                  <li className="sd-bub sd-b1" data-for="creator" style={{ "--d": "0" }}>
                    <i>M</i>New collab · Reel · ₹18,000
                  </li>{" "}
                  <li className="sd-bub sd-b2" data-for="creator" style={{ "--d": "1" }}>
                    <i>M</i>Can you post by 12 Dec?
                  </li>{" "}
                  <li className="sd-bub sd-b3 sd-me sd-bx" data-for="creator" id="sdBubBid">
                    <i>You</i>
                    <span>Bid sent · ₹18,000</span>
                  </li>{" "}
                  <li className="sd-bub sd-b4" data-for="brand" style={{ "--d": "0" }}>
                    <i>3</i>New bids on your collab
                  </li>{" "}
                  <li className="sd-bub sd-b5" data-for="brand" style={{ "--d": "1" }}>
                    <i>AI</i>Love this, I'm in!
                  </li>{" "}
                  <li className="sd-bub sd-b6 sd-me sd-bx" data-for="brand" id="sdBubEsc">
                    <i className="sd-lock-w">
                      <b className="sd-lock"></b>
                    </i>
                    <span>Escrow funded · ₹18,000</span>
                  </li>{" "}
                </ul>{" "}
                <p className="note sd-note sd-note-c" data-for="creator">
                  Best match
                </p>{" "}
                <p className="note sd-note sd-note-b" data-for="brand">
                  Sample profile
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <p className="sr-only" id="sdLive" aria-live="polite"></p>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

function Trust() {
  return (
    <>
      {/* ── part: trust ── */}{" "}
      {/* Trust (v5): static two-line headline, escrow track (tap to move, refund branch), payout copy + ink receipt calculator */}{" "}
      <section className="sec butter tr sheet" id="trust" data-hdr="light" aria-labelledby="trH">
        {" "}
        <div className="in tr-in">
          {" "}
          <div className="tr-head">
            {" "}
            <h2 className="tr-h" id="trH" data-reveal>
              <span className="tr-l">Money moves only</span> <span className="tr-l">when work does.</span>
            </h2>{" "}
            <p className="body-l tr-intro">
              Sample deal: Mirevo Skincare pays Ananya Iyer ₹18,000 for one Instagram Reel. Tap a step to see
              what each side sees.
            </p>{" "}
          </div>{" "}
          {/* escrow track: the coin rests on step 1 and moves only when a step is chosen */}{" "}
          <div className="tr-track" id="trTrack" role="group" aria-label="Escrow steps for the sample deal">
            {" "}
            <button className="tr-node" type="button" data-i="0" aria-controls="trCap" aria-current="step">
              {" "}
              <span className="tr-n">01</span>
              <span className="tr-nt">Brand pays in</span>
              <span className="tr-rail">
                <span className="tr-rl"></span>
                <span className="tr-dot"></span>
              </span>{" "}
            </button>{" "}
            <button className="tr-node" type="button" data-i="1" aria-controls="trCap">
              {" "}
              <span className="tr-n">02</span>
              <span className="tr-nt">Linkloom holds it</span>
              <span className="tr-rail">
                <span className="tr-rl"></span>
                <span className="tr-dot"></span>
              </span>{" "}
            </button>{" "}
            <button className="tr-node" type="button" data-i="2" aria-controls="trCap">
              {" "}
              <span className="tr-n">03</span>
              <span className="tr-nt">Work approved</span>
              <span className="tr-rail">
                <span className="tr-rl"></span>
                <span className="tr-dot"></span>
              </span>{" "}
            </button>{" "}
            <button className="tr-node" type="button" data-i="3" aria-controls="trCap">
              {" "}
              <span className="tr-n">04</span>
              <span className="tr-nt">Paid to UPI or bank</span>
              <span className="tr-rail">
                <span className="tr-rl"></span>
                <span className="tr-dot"></span>
                <span className="tr-arr"></span>
              </span>{" "}
            </button>{" "}
            <button className="tr-node tr-node-r" type="button" data-i="4" aria-controls="trCap" disabled>
              {" "}
              <span className="tr-rail">
                <span className="tr-rl"></span>
                <span className="tr-dot"></span>
              </span>
              <span className="tr-nt">Refunded to brand</span>{" "}
            </button>{" "}
            <button className="tr-sw" id="trRefund" type="button" role="switch" aria-checked="false">
              {" "}
              <span className="tr-sw-k" aria-hidden="true"></span>
              <span>What if the work never arrives?</span>{" "}
            </button>{" "}
            <div className="tr-cap" id="trCap" aria-live="polite">
              {" "}
              <p className="sr-only" id="trCapStep">
                Step 1 of 4, brand pays in.
              </p>{" "}
              <div className="tr-cap-col tr-cap-b">
                <span className="tr-who">Brand sees</span>
                <b>₹18,000 paid in</b>
                <span className="tr-cap-x">It goes into escrow, not straight to the creator.</span>
              </div>{" "}
              <div className="tr-cap-col tr-cap-c">
                <span className="tr-who">Creator sees</span>
                <b>Bid accepted</b>
                <span className="tr-cap-x">Work starts once Mirevo has paid in.</span>
              </div>{" "}
            </div>{" "}
            <svg className="tr-svg" aria-hidden="true" focusable="false">
              <path className="tr-br-ghost" d="" />
              <path className="tr-br" d="" pathLength="1" />
              <path className="tr-prog" d="" />
            </svg>{" "}
            <span className="tr-tok" aria-hidden="true">
              <span>₹</span>
            </span>{" "}
          </div>{" "}
          {/* payout: copy + the ink receipt as a live calculator */}{" "}
          <div className="tr-pay">
            {" "}
            <div className="tr-pay-copy">
              {" "}
              <h3 className="h1" data-reveal>
                No surprises at payout
              </h3>{" "}
              <p className="body-l">See exactly what lands in your account before you tap withdraw.</p>{" "}
            </div>{" "}
            <div className="tr-calc-wrap">
              {" "}
              <form className="tr-calc" id="trCalc" aria-labelledby="trCalcH" noValidate>
                {" "}
                <div className="tr-calc-h">
                  <span id="trCalcH">Payout slip</span>
                  <span className="tr-ex">Example</span>
                </div>{" "}
                <div className="tr-calc-l">
                  {" "}
                  <label className="tr-price-l" htmlFor="trPrice">
                    Agreed price
                  </label>{" "}
                  <div className="tr-price-in">
                    <span className="tr-rs" aria-hidden="true">
                      ₹
                    </span>
                    <input
                      id="trPrice"
                      name="price"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck="false"
                      defaultValue="18,000"
                      aria-describedby="trRangeHint"
                    />
                  </div>{" "}
                  <input
                    className="tr-range"
                    id="trRange"
                    type="range"
                    min="1000"
                    max="200000"
                    step="500"
                    defaultValue="18000"
                    aria-label="Agreed price slider"
                    aria-valuetext="₹18,000"
                  />{" "}
                  <p className="tr-range-h" id="trRangeHint">
                    <span>₹1,000</span>
                    <span>₹2,00,000</span>
                  </p>{" "}
                  <div className="tr-chips" role="group" aria-label="Quick prices">
                    {" "}
                    <button type="button" data-v="5000" aria-pressed="false">
                      ₹5k
                    </button>{" "}
                    <button type="button" data-v="10000" aria-pressed="false">
                      ₹10k
                    </button>{" "}
                    <button type="button" data-v="18000" aria-pressed="true">
                      ₹18k
                    </button>{" "}
                    <button type="button" data-v="50000" aria-pressed="false">
                      ₹50k
                    </button>{" "}
                  </div>{" "}
                  <div className="tr-dest">
                    {" "}
                    <span className="tr-dest-l" id="trDestL">
                      Paid to
                    </span>{" "}
                    <div className="tr-seg" role="radiogroup" aria-labelledby="trDestL">
                      {" "}
                      <button type="button" role="radio" aria-checked="true" data-d="upi">
                        UPI
                      </button>{" "}
                      <button type="button" role="radio" aria-checked="false" data-d="bank" tabIndex="-1">
                        Bank
                      </button>{" "}
                    </div>{" "}
                    <span className="tr-handle" id="trHandle">
                      ananya••••@upi
                    </span>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="tr-calc-r">
                  {" "}
                  <dl className="tr-rows">
                    {" "}
                    <div>
                      <dt>Agreed price</dt>
                      <dd id="trOutP">₹18,000</dd>
                    </div>{" "}
                    <div>
                      <dt>
                        Platform fee{" "}
                        <span className="tr-eg" hidden>
                          <span id="trRate"></span>
                        </span>
                      </dt>
                      <dd id="trOutFee">None</dd>
                    </div>{" "}
                    <div>
                      <dt>Tax / withholding</dt>
                      <dd>As per confirmed rules</dd>
                    </div>{" "}
                  </dl>{" "}
                  <div className="tr-recv">
                    <span>You receive</span>
                    <span className="tr-net">
                      <span id="trOutNet">₹18,000</span> − tax
                    </span>
                  </div>{" "}
                  <span className="tr-escrow">Released from escrow on approval</span>{" "}
                </div>{" "}
                <p className="sr-only" id="trSay" aria-live="polite"></p>{" "}
              </form>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

function Platforms() {
  return (
    <>
      {/* ── part: platforms ── */}{" "}
      {/* Platforms: funkhaus P8 banner rows that flood with a curved colour front; each opens a format drawer with a morphing device frame */}{" "}
      <section className="sec light sheet pf" id="platforms" data-hdr="light" aria-labelledby="pf-title">
        {" "}
        <div className="in pf-head">
          {" "}
          <h2 className="display-l pf-title" id="pf-title" data-reveal>
            Built for the platforms India creates on.
          </h2>{" "}
          <p className="body-l pf-lede">
            Open a platform, then pick a format to see what a collab for it looks like. Every collab, name and
            budget shown here is a sample.
          </p>{" "}
        </div>{" "}
        <div className="pf-rows">
          {" "}
          {/* ── Instagram ── */}{" "}
          <div className="pf-item pf-ig" data-pf="ig">
            {" "}
            <h3 className="pf-h">
              {" "}
              <button
                className="pf-row"
                id="pf-r-ig"
                type="button"
                aria-expanded="false"
                aria-controls="pf-d-ig"
              >
                {" "}
                <span className="pf-run" aria-hidden="true">
                  <span
                    className="pf-track"
                    data-run="Reels|Posts|Stories"
                    data-ico="assets/icon-instagram.svg"
                  ></span>
                </span>{" "}
                <span className="pf-box">
                  {" "}
                  <span className="pf-roll">
                    {" "}
                    <span className="pf-lab">
                      <img className="pf-ico" src="assets/icon-instagram.svg" width="32" height="32" alt="" />
                      <span className="pf-name">Instagram</span>
                    </span>{" "}
                    <span className="pf-fl">Reels · Posts · Stories</span>{" "}
                    <span className="pf-tog" aria-hidden="true">
                      <i></i>
                    </span>{" "}
                  </span>{" "}
                </span>{" "}
              </button>{" "}
            </h3>{" "}
            <div className="pf-drawer" id="pf-d-ig" role="region" aria-labelledby="pf-r-ig" hidden>
              {" "}
              <div className="pf-dr">
                {" "}
                <div className="pf-dr-in">
                  {" "}
                  <div className="pf-side">
                    {" "}
                    <div className="pf-tabs" role="tablist" aria-label="Instagram formats">
                      {" "}
                      <i className="pf-ind" aria-hidden="true"></i>{" "}
                      <button
                        className="pf-tab"
                        role="tab"
                        type="button"
                        id="pf-t-reel"
                        aria-selected="true"
                        aria-controls="pf-p-ig"
                        data-f="reel"
                      >
                        Reels
                      </button>{" "}
                      <button
                        className="pf-tab"
                        role="tab"
                        type="button"
                        id="pf-t-post"
                        aria-selected="false"
                        aria-controls="pf-p-ig"
                        data-f="post"
                        tabIndex="-1"
                      >
                        Posts
                      </button>{" "}
                      <button
                        className="pf-tab"
                        role="tab"
                        type="button"
                        id="pf-t-story"
                        aria-selected="false"
                        aria-controls="pf-p-ig"
                        data-f="story"
                        tabIndex="-1"
                      >
                        Stories
                      </button>{" "}
                    </div>{" "}
                    <div className="pf-panel" role="tabpanel" id="pf-p-ig" aria-labelledby="pf-t-reel">
                      {" "}
                      <p className="pf-fname">Reel</p>{" "}
                      <p className="pf-desc">Vertical 9:16 video for the Reels tab and the feed.</p>{" "}
                      <div className="pf-brief">
                        {" "}
                        <p className="pf-bwho">Collab from Mirevo Skincare</p>{" "}
                        <p className="pf-bline">1 Reel · 30–⁠45 s · product in first 3 s · ₹18,000</p>{" "}
                      </div>{" "}
                      <a className="lq lq-s pf-cta" href="brand.html#post">
                        Post a collab like this
                      </a>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="pf-stage" aria-hidden="true">
                    {" "}
                    <div className="pf-guides">
                      <i data-r="9:16" className="is-on"></i>
                      <i data-r="1:1"></i>
                    </div>{" "}
                    <div className="pf-device" data-shape="tall">
                      {" "}
                      <i className="pf-island"></i>{" "}
                      <div className="pf-screen">
                        {" "}
                        {/* Reel */}{" "}
                        <div className="pf-mock pf-m-reel is-on" data-f="reel">
                          {" "}
                          <div className="pf-scene">
                            {" "}
                            <i className="pf-sun"></i>{" "}
                            <i className="pf-bot">
                              <i className="pf-bot-cap"></i>
                              <i className="pf-bot-body">
                                <b>Mirevo</b>
                              </i>
                            </i>{" "}
                          </div>{" "}
                          <div className="pf-ui">
                            {" "}
                            <p className="pf-top">Reels</p>{" "}
                            <p className="pf-rail">
                              <span>
                                <i className="pf-heart"></i>
                                <small>4.1K</small>
                              </span>
                              <span>
                                <i className="pf-bub"></i>
                                <small>86</small>
                              </span>
                              <span>
                                <i className="pf-send"></i>
                              </span>
                            </p>{" "}
                            <div className="pf-meta">
                              {" "}
                              <p className="pf-who">
                                <i className="pf-av"></i>
                                <b>ananya.iyer</b>
                              </p>{" "}
                              <p className="pf-cap">Day 14 with the barrier serum</p>{" "}
                              <p className="pf-aud">
                                <i className="pf-disc"></i>Original audio
                              </p>{" "}
                            </div>{" "}
                            <p className="pf-prog">
                              <i className="pf-prog-3"></i>
                              <i className="pf-prog-f"></i>
                            </p>{" "}
                          </div>{" "}
                        </div>{" "}
                        {/* Post */}{" "}
                        <div className="pf-mock pf-m-post" data-f="post">
                          {" "}
                          <div className="pf-car">
                            <div className="pf-car-t">
                              {" "}
                              <div className="pf-sl pf-sl1">
                                <i className="pf-bot">
                                  <i className="pf-bot-cap"></i>
                                  <i className="pf-bot-body">
                                    <b>Mirevo</b>
                                  </i>
                                </i>
                              </div>{" "}
                              <div className="pf-sl pf-sl2">
                                <span>
                                  <b>Day 1</b>
                                </span>
                                <span>
                                  <b>Day 14</b>
                                </span>
                              </div>{" "}
                              <div className="pf-sl pf-sl3">
                                <p>3 things I noticed</p>
                              </div>{" "}
                            </div>
                          </div>{" "}
                          <div className="pf-ui">
                            {" "}
                            <p className="pf-who pf-chip">
                              <i className="pf-av"></i>
                              <span className="pf-whot">
                                <b>ananya.iyer</b>
                                <small>Paid partnership with mirevo</small>
                              </span>
                            </p>{" "}
                            <p className="pf-cnt">
                              <span>1/3</span>
                              <span>2/3</span>
                              <span>3/3</span>
                            </p>{" "}
                            <p className="pf-likes">
                              <i className="pf-heart"></i>2,481 likes
                            </p>{" "}
                            <p className="pf-dots">
                              <i></i>
                              <i></i>
                              <i></i>
                            </p>{" "}
                          </div>{" "}
                        </div>{" "}
                        {/* Story */}{" "}
                        <div className="pf-mock pf-m-story" data-f="story">
                          {" "}
                          <div className="pf-fr pf-fr1">
                            <p className="pf-big">Day 1</p>
                            <p className="pf-sm">barrier check</p>
                          </div>{" "}
                          <div className="pf-fr pf-fr2">
                            <i className="pf-sun"></i>
                            <i className="pf-bot">
                              <i className="pf-bot-cap"></i>
                              <i className="pf-bot-body">
                                <b>Mirevo</b>
                              </i>
                            </i>
                          </div>{" "}
                          <div className="pf-fr pf-fr3">
                            <p className="pf-big">Day 14</p>
                            <p className="pf-link">
                              <i className="pf-lnk"></i>Shop the serum
                            </p>
                          </div>{" "}
                          <div className="pf-ui">
                            {" "}
                            <p className="pf-segs">
                              <i>
                                <b></b>
                              </i>
                              <i>
                                <b></b>
                              </i>
                              <i>
                                <b></b>
                              </i>
                            </p>{" "}
                            <p className="pf-who">
                              <i className="pf-av"></i>
                              <b>ananya.iyer</b>
                              <small>2h</small>
                            </p>{" "}
                            <p className="pf-reply">
                              <span>Send message</span>
                              <i className="pf-heart"></i>
                              <i className="pf-send"></i>
                            </p>{" "}
                          </div>{" "}
                        </div>{" "}
                      </div>{" "}
                      <p className="pf-note pf-n-reel is-on" data-f="reel">
                        product in
                        <br />
                        the first 3 s<i className="pf-arc"></i>
                      </p>{" "}
                      <p className="pf-note pf-n-post" data-f="post">
                        swipe for
                        <br />3 slides<i className="pf-arc"></i>
                      </p>{" "}
                      <p className="pf-note pf-n-story" data-f="story">
                        link sticker
                        <br />
                        on frame 3<i className="pf-arc"></i>
                      </p>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          {/* ── YouTube ── */}{" "}
          <div className="pf-item pf-yt" data-pf="yt">
            {" "}
            <h3 className="pf-h">
              {" "}
              <button
                className="pf-row"
                id="pf-r-yt"
                type="button"
                aria-expanded="false"
                aria-controls="pf-d-yt"
              >
                {" "}
                <span className="pf-run" aria-hidden="true">
                  <span
                    className="pf-track"
                    data-run="Videos|Shorts"
                    data-ico="assets/icon-youtube.svg"
                  ></span>
                </span>{" "}
                <span className="pf-box">
                  {" "}
                  <span className="pf-roll">
                    {" "}
                    <span className="pf-lab">
                      <img className="pf-ico" src="assets/icon-youtube.svg" width="32" height="32" alt="" />
                      <span className="pf-name">YouTube</span>
                    </span>{" "}
                    <span className="pf-fl">Videos · Shorts</span>{" "}
                    <span className="pf-tog" aria-hidden="true">
                      <i></i>
                    </span>{" "}
                  </span>{" "}
                </span>{" "}
              </button>{" "}
            </h3>{" "}
            <div className="pf-drawer" id="pf-d-yt" role="region" aria-labelledby="pf-r-yt" hidden>
              {" "}
              <div className="pf-dr">
                {" "}
                <div className="pf-dr-in">
                  {" "}
                  <div className="pf-side">
                    {" "}
                    <div className="pf-tabs" role="tablist" aria-label="YouTube formats">
                      {" "}
                      <i className="pf-ind" aria-hidden="true"></i>{" "}
                      <button
                        className="pf-tab"
                        role="tab"
                        type="button"
                        id="pf-t-video"
                        aria-selected="true"
                        aria-controls="pf-p-yt"
                        data-f="video"
                      >
                        Videos
                      </button>{" "}
                      <button
                        className="pf-tab"
                        role="tab"
                        type="button"
                        id="pf-t-short"
                        aria-selected="false"
                        aria-controls="pf-p-yt"
                        data-f="short"
                        tabIndex="-1"
                      >
                        Shorts
                      </button>{" "}
                    </div>{" "}
                    <div className="pf-panel" role="tabpanel" id="pf-p-yt" aria-labelledby="pf-t-video">
                      {" "}
                      <p className="pf-fname">Video</p>{" "}
                      <p className="pf-desc">
                        Long-form 16:9 video, with the brand segment as its own chapter.
                      </p>{" "}
                      <div className="pf-brief">
                        {" "}
                        <p className="pf-bwho">Collab from Mirevo Skincare</p>{" "}
                        <p className="pf-bline">
                          4 min review · 60–⁠90 s integration at 0:42–⁠1:30 · ₹45,000
                        </p>{" "}
                      </div>{" "}
                      <a className="lq lq-s pf-cta" href="brand.html#post">
                        Post a collab like this
                      </a>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="pf-stage" aria-hidden="true">
                    {" "}
                    <div className="pf-guides">
                      <i data-r="16:9" className="is-on"></i>
                      <i data-r="9:16"></i>
                    </div>{" "}
                    <div className="pf-device" data-shape="wide">
                      {" "}
                      <i className="pf-island"></i>{" "}
                      <div className="pf-screen">
                        {" "}
                        {/* Video */}{" "}
                        <div className="pf-mock pf-m-video is-on" data-f="video">
                          {" "}
                          <div className="pf-set">
                            {" "}
                            <i className="pf-win"></i>
                            <i className="pf-lamp"></i>{" "}
                            <i className="pf-person">
                              <i></i>
                            </i>{" "}
                            <i className="pf-desk"></i>{" "}
                            <i className="pf-bot pf-vbot">
                              <i className="pf-bot-cap"></i>
                              <i className="pf-bot-body">
                                <b>Mirevo</b>
                              </i>
                            </i>{" "}
                          </div>{" "}
                          <div className="pf-ui">
                            {" "}
                            <p className="pf-vtitle">My 4-week skincare routine, honestly</p>{" "}
                            <p className="pf-promo">Includes paid promotion</p>{" "}
                            <div className="pf-player">
                              {" "}
                              <div className="pf-scrub">
                                {" "}
                                <i className="pf-ch" style={{ "--a": "0", "--b": "16.67" }}></i>{" "}
                                <i className="pf-ch pf-ch-b" style={{ "--a": "16.67", "--b": "35.71" }}></i>{" "}
                                <i className="pf-ch" style={{ "--a": "35.71", "--b": "75.4" }}></i>{" "}
                                <i className="pf-ch" style={{ "--a": "75.4", "--b": "100" }}></i>{" "}
                                <span className="pf-played">
                                  <i className="pf-ch" style={{ "--a": "0", "--b": "16.67" }}></i>
                                  <i className="pf-ch" style={{ "--a": "35.71", "--b": "75.4" }}></i>
                                  <i className="pf-ch" style={{ "--a": "75.4", "--b": "100" }}></i>
                                </span>{" "}
                                <span className="pf-tip">Brand segment 0:42–1:30</span>{" "}
                                <span className="pf-ph">
                                  <i></i>
                                </span>{" "}
                              </div>{" "}
                              <p className="pf-ctrl">
                                <i className="pf-pause"></i>
                                <span className="pf-tc">
                                  <span data-tc>0:53</span> / 4:12
                                </span>
                                <span className="pf-chn" data-chn>
                                  Brand segment
                                </span>
                              </p>{" "}
                            </div>{" "}
                          </div>{" "}
                        </div>{" "}
                        {/* Short */}{" "}
                        <div className="pf-mock pf-m-short" data-f="short">
                          {" "}
                          <div className="pf-feed">
                            <div className="pf-feed-t">
                              {" "}
                              <div className="pf-sh pf-sh1">
                                <p className="pf-big">Serum in 30 s</p>
                                <i className="pf-bot">
                                  <i className="pf-bot-cap"></i>
                                  <i className="pf-bot-body">
                                    <b>Mirevo</b>
                                  </i>
                                </i>
                              </div>{" "}
                              <div className="pf-sh pf-sh2">
                                <i className="pf-sun"></i>
                                <p className="pf-big">Day 14</p>
                              </div>{" "}
                              <div className="pf-sh pf-sh1">
                                <p className="pf-big">Serum in 30 s</p>
                                <i className="pf-bot">
                                  <i className="pf-bot-cap"></i>
                                  <i className="pf-bot-body">
                                    <b>Mirevo</b>
                                  </i>
                                </i>
                              </div>{" "}
                            </div>
                          </div>{" "}
                          <div className="pf-ui">
                            {" "}
                            <p className="pf-top">Shorts</p>{" "}
                            <p className="pf-rail pf-rail-yt">
                              <span>
                                <b className="pf-ic">
                                  <i className="pf-heart"></i>
                                </b>
                                <small>18K</small>
                              </span>
                              <span>
                                <b className="pf-ic">
                                  <i className="pf-bub"></i>
                                </b>
                                <small>312</small>
                              </span>
                              <span>
                                <b className="pf-ic">
                                  <i className="pf-send"></i>
                                </b>
                                <small>Share</small>
                              </span>
                              <span>
                                <i className="pf-disc"></i>
                              </span>
                            </p>{" "}
                            <div className="pf-meta">
                              {" "}
                              <p className="pf-who">
                                <i className="pf-av"></i>
                                <b>@ananya.iyer</b>
                                <span className="pf-subs">Subscribe</span>
                              </p>{" "}
                              <p className="pf-cap">Serum in 30 s, no filter</p>{" "}
                            </div>{" "}
                            <p className="pf-prog pf-prog-yt">
                              <i className="pf-prog-f"></i>
                            </p>{" "}
                          </div>{" "}
                        </div>{" "}
                      </div>{" "}
                      <p className="pf-note pf-n-video is-on" data-f="video">
                        the part the
                        <br />
                        brand pays for<i className="pf-arc"></i>
                      </p>{" "}
                      <p className="pf-note pf-n-short" data-f="short">
                        hook in
                        <br />
                        the first 2 s<i className="pf-arc"></i>
                      </p>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

function Start() {
  return (
    <>
      {/* ── part: cta ── */}{" "}
      {/* CTA: the finale. Two rings slide along "Start weaving." like rings on a rod and link at the centre */}{" "}
      <section className="sec dark ct sheet" id="start" aria-labelledby="ctH">
        {" "}
        <canvas className="ct-bg" aria-hidden="true"></canvas>{" "}
        <div className="in ct-in">
          {" "}
          <div className="ct-hwrap">
            {" "}
            <div className="ct-art ct-back" aria-hidden="true">
              <div className="ct-knot">
                <i className="ct-r ct-rc"></i>
                <i className="ct-r ct-rv"></i>
                <i className="ct-r ct-rc ct-rc2"></i>
              </div>
            </div>{" "}
            <h2 className="ct-h" id="ctH" data-reveal>
              Start
              <br className="ct-bm" /> weaving.
            </h2>{" "}
            <div className="ct-art ct-front" aria-hidden="true"></div>{" "}
          </div>{" "}
          <div className="ct-foot" data-ct-in>
            {" "}
            <p className="ct-sub">
              <span className="ct-cr">Your next brand deal is one bid away.</span>{" "}
              <span className="ct-br">Your next creator is one search away.</span>
            </p>{" "}
            <div className="ct-ctas">
              {" "}
              <a className="lq lq-p lq-coral" href="signin.html?join=1&role=creator">
                Find brand deals
              </a>{" "}
              <a className="lq lq-p lq-violet" href="signin.html?join=1&role=brand">
                Hire creators
              </a>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </>
  );
}

export function Page() {
  return (
    <>
      {" "}
      <div className="ll-cur" aria-hidden="true">
        <div className="ll-cur-in">
          <span className="ll-cur-dot"></span>
          <span className="ll-cur-txt"></span>
        </div>
      </div>{" "}
      <header className="hdr" id="hdr">
        {" "}
        <a className="hbox hlogo" href="#top" aria-label="Linkloom home">
          <img src="assets/logo-mark.svg" width="32" height="32" alt="" />
          <span>linkloom</span>
        </a>{" "}
        <nav className="hbox hnav" aria-label="Main">
          {" "}
          <a href="#sides" data-pick-side="creator">
            For creators
          </a>{" "}
          <a href="#sides" data-pick-side="brand">
            For brands
          </a>{" "}
          <a href="#how">How it works</a>{" "}
        </nav>{" "}
        <div className="hright">
          {" "}
          <a className="hbox hsign" href="signin.html">
            Sign in
          </a>{" "}
          <a className="lq lq-p" href="signin.html?join=1">
            <span className="t">Get started</span>
            <span className="t2" aria-hidden="true">
              Get started
            </span>
          </a>{" "}
        </div>{" "}
      </header>{" "}
      <main id="top">
        <Hero />
        <How />
        <Sides />
        <Trust />
        <Platforms />
        <Start />
      </main>{" "}
      {/* Footer (67:345) */}{" "}
      <footer className="sec dark foot">
        {" "}
        <div className="in">
          {" "}
          <p className="wordmark" aria-label="linkloom">
            <span className="wm-mask" aria-hidden="true">
              <span className="ch">l</span>
              <span className="ch">i</span>
              <span className="ch">n</span>
              <span className="ch">k</span>
              <span className="ch">l</span>
              <span className="ch o1">o</span>
              <span className="ch o2">o</span>
              <span className="ch">m</span>
            </span>
          </p>{" "}
          <div className="bento">
            {" "}
            <div className="box explore">
              {" "}
              <nav className="flinks" aria-label="Footer">
                {" "}
                <a className="cur" href="#top" aria-current="page">
                  Home
                </a>{" "}
                <a href="app.html#home">For creators</a> <a href="brand.html#home">For brands</a>{" "}
                <a href="#how">
                  How it works <span className="pill coral">6 steps</span>
                </a>{" "}
                <a href="#trust">Escrow & payouts</a> <a href="#start">Help centre</a>{" "}
              </nav>{" "}
              <p className="body-s">English · more languages soon</p>{" "}
            </div>{" "}
            <div className="contact">
              {" "}
              <div className="box email">
                <img src="assets/footer-rings.svg" width="26" height="18" alt="" />
                <span>hello@linkloom.in</span>
              </div>{" "}
              <div className="box android">
                <div className="t">
                  Android app <span className="pill butter">Coming soon</span>
                </div>
                <p className="body-s">Bid, track work and get paid from your phone.</p>
              </div>{" "}
              <div className="box updates">
                {" "}
                <p className="t">Get new collabs in your inbox</p>{" "}
                <form className="field" id="subForm" noValidate>
                  {" "}
                  <label
                    className="sr"
                    htmlFor="subEmail"
                    style={{
                      position: "absolute",
                      width: "1px",
                      height: "1px",
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                    }}
                  >
                    Your email
                  </label>{" "}
                  <input
                    id="subEmail"
                    name="email"
                    type="email"
                    placeholder="Your email"
                    autoComplete="email"
                  />{" "}
                  <button className="sub" type="submit" aria-label="Subscribe">
                    <img src="assets/arrow.svg" width="18" height="18" alt="" />
                  </button>{" "}
                </form>{" "}
                <p className="fmsg" id="fmsg" aria-live="polite"></p>{" "}
                <div className="legal">
                  {" "}
                  <a href="#start">
                    Privacy policy
                    <img src="assets/chevron.svg" width="8" height="14" alt="" />
                  </a>{" "}
                  <a href="#start">
                    Terms of use
                    <img src="assets/chevron.svg" width="8" height="14" alt="" />
                  </a>{" "}
                  <a href="#trust">
                    Refunds & escrow
                    <img src="assets/chevron.svg" width="8" height="14" alt="" />
                  </a>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
            <div className="box follow">
              {" "}
              <div>
                <p className="t">Follow the loom</p>{" "}
                <div className="social">
                  <a href="#start">
                    Instagram
                    <img src="assets/out.svg" width="12" height="12" alt="" />
                  </a>
                  <a href="#start">
                    YouTube
                    <img src="assets/out.svg" width="12" height="12" alt="" />
                  </a>
                  <a href="#start">
                    LinkedIn
                    <img src="assets/out.svg" width="12" height="12" alt="" />
                  </a>
                </div>{" "}
              </div>{" "}
              <p className="note" data-write>
                say hi, we weave back
              </p>{" "}
            </div>{" "}
            <div className="statement">
              {" "}
              <div className="top">
                {" "}
                <p className="h1">Work that pays, woven.</p>{" "}
              </div>{" "}
              <p className="copy">© 2026 Linkloom · Made in India</p>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </footer>{" "}
    </>
  );
}
