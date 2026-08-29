/*!
 * number-input-guards — vanilla fallback for pages that are not rendered by the
 * Next.js app (a standalone HTML print sheet, a legacy page, anything served
 * straight out of /public).
 *
 * Mirrors src/lib/numberInputGuards.ts, which is the reference implementation —
 * change both together. Kept as its own file rather than imported because
 * /public is served verbatim and is never run through the bundler.
 *
 * Blocks mouse-wheel and Arrow Up/Down edits on <input type="number">. Typing,
 * paste, the spinner buttons and validation are untouched.
 *
 *   <script src="/number-input-guards.js" defer></script>
 *
 * Opt a field out with data-allow-scroll or class="allow-scroll".
 */
(function () {
  "use strict";
  if (typeof document === "undefined" || window.__numberInputGuards) return;
  window.__numberInputGuards = true;

  function isGuarded(el) {
    return (
      !!el &&
      el.tagName === "INPUT" &&
      el.type === "number" &&
      !el.hasAttribute("data-allow-scroll") &&
      !el.classList.contains("allow-scroll")
    );
  }

  var armed = null;

  function blockWheel(e) {
    e.preventDefault();
  }

  function disarm() {
    if (armed) armed.removeEventListener("wheel", blockWheel);
    armed = null;
  }

  // Non-passive, so it can preventDefault — but only ever on the one focused
  // field, never on the document, which would slow every page scroll down.
  function arm(el) {
    disarm();
    if (!isGuarded(el)) return;
    armed = el;
    armed.addEventListener("wheel", blockWheel, { passive: false });
  }

  document.addEventListener("focusin", function (e) {
    arm(e.target);
  });
  document.addEventListener("focusout", disarm);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (!isGuarded(e.target)) return;
    e.preventDefault();
  });

  // Covers a field that is already focused (autofocus) when this script runs.
  arm(document.activeElement);
})();
