/* The brand logo picker (Builder A): choose, validate, preview. Used by #setup and the Edit profile sheet.
   The logo is kept as a data URL until the profile is saved (live mode then uploads it). */
import { useRef, useState } from "react";
import { Icon, Lq } from "@/shared/react/view";

const L = window.LLD;
const TYPES = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/svg+xml": 1 },
  MAX = 2 * 1024 * 1024;
let n = 0;

/** `value` is the logo URL (or null); `initials` is what the empty frame shows. */
export function LogoPicker({ value, onChange, initials }) {
  const id = useRef(null);
  if (!id.current) id.current = "lg" + ++n;
  const [err, setErr] = useState("");
  const file = useRef(null),
    pick = useRef(null),
    frame = useRef(null);
  const choose = f => {
    if (!f) return;
    if (!TYPES[f.type])
      return setErr(
        `That file is ${f.type ? "a " + (f.type.split("/")[1] || "different").toUpperCase() + " file" : "not an image"}. Use PNG, JPG, WebP or SVG.`,
      );
    if (f.size > MAX) return setErr(`That logo is ${(f.size / 1048576).toFixed(1)} MB. Use one under 2 MB.`);
    if (!f.size) return setErr("That file is empty. Try another logo.");
    const rd = new FileReader();
    rd.onerror = () => setErr("We couldn't read that file. Try another logo.");
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        if (f.type !== "image/svg+xml" && Math.min(im.naturalWidth, im.naturalHeight) < 64)
          return setErr(
            `That logo is only ${im.naturalWidth} × ${im.naturalHeight} px. Use one at least 64 px on each side.`,
          );
        setErr("");
        onChange(rd.result);
        L.motion && L.motion.bump && L.motion.bump(frame.current);
      };
      im.onerror = () => setErr("We couldn't open that image. Try another file.");
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  const k = id.current;
  return (
    <div className="profile-lg">
      <div
        className={`profile-lg-frame${value ? " has-img" : ""}`}
        data-frame=""
        aria-hidden="true"
        ref={frame}
      >
        {value ? <img src={value} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="profile-lg-side">
        <p className="t-label" id={`${k}-l`}>
          Logo
        </p>
        <div className="row wrap">
          <Lq
            className="lq-s lq-sm"
            data-pick=""
            aria-describedby={`${k}-l ${k}-h`}
            ref={pick}
            onClick={() => file.current.click()}
          >
            <Icon n="upload" className="ic" />
            <span data-pl="">{value ? "Replace logo" : "Upload logo"}</span>
          </Lq>
          <Lq
            className="lq-s lq-sm"
            data-rm=""
            hidden={!value}
            onClick={() => {
              onChange(null);
              setErr("");
              pick.current.focus();
            }}
          >
            Remove<span className="sr-only"> logo</span>
          </Lq>
        </div>
        <input
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          tabIndex={-1}
          aria-label="Logo file"
          data-file=""
          ref={file}
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            choose(f);
          }}
        />
        <p className="help" id={`${k}-h`}>
          PNG, JPG, WebP or SVG, up to 2 MB. A square logo on a plain background looks best.
        </p>
        <p className="err" aria-live="polite" data-err="">
          {err}
        </p>
      </div>
    </div>
  );
}
