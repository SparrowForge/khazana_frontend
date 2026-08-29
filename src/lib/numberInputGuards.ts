/**
 * Stops `<input type="number">` from changing value by accident.
 *
 * Two ways a number field changes without anyone typing:
 *   • the mouse wheel, while the field has focus and the pointer is over it
 *   • the Up/Down arrow keys
 * Both are easy to trigger while scrolling a long entry form or tabbing through
 * it, and on a qty or rate field a silent ±1 is a wrong document.
 *
 * Typing, paste, the spinner buttons, `min`/`max`/`step` validation and every
 * change/blur handler are untouched — only these two gestures are suppressed.
 *
 * Cost: three delegated listeners on the document, no matter how many inputs
 * are on screen, so dynamically rendered fields are covered the moment they are
 * focused and there is nothing to wire up per input. The one listener that has
 * to be non-passive (`wheel`, since it calls `preventDefault`) is attached to
 * the focused field alone and removed when it blurs, so the document never
 * carries a non-passive wheel handler that would slow page scrolling down.
 *
 * Opt out per field with `data-allow-scroll` or `class="allow-scroll"`:
 *
 *   <input type="number" data-allow-scroll />
 *
 * which restores the browser's own wheel/arrow behaviour for that field.
 */

const ALLOW_ATTR = "data-allow-scroll";
const ALLOW_CLASS = "allow-scroll";

/** A number field this guard applies to — i.e. one that has not opted out. */
function isGuardedNumberInput(target: EventTarget | null): target is HTMLInputElement {
  if (!target || !(target as HTMLElement).tagName) return false;
  const el = target as HTMLInputElement;
  return (
    el.tagName === "INPUT" &&
    el.type === "number" &&
    !el.hasAttribute(ALLOW_ATTR) &&
    !el.classList.contains(ALLOW_CLASS)
  );
}

/**
 * Installs the guards. Safe to call more than once (each call returns its own
 * cleanup), and a no-op outside the browser.
 *
 * @returns a function that removes every listener again.
 */
export function installNumberInputGuards(doc?: Document): () => void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target) return () => {};

  /** The focused field currently carrying the wheel listener, if any. */
  let armed: HTMLInputElement | null = null;

  // Blocking the wheel also blocks the page scrolling *while the pointer sits
  // over this one focused field*. That is the trade for not deducting a unit
  // from a cart line: moving the pointer a few pixels off the box scrolls as
  // normal. Blurring the field instead would scroll the page, but it would also
  // fire the commit-on-blur handlers the entry forms hang off.
  const blockWheel = (e: WheelEvent) => e.preventDefault();

  const disarm = () => {
    armed?.removeEventListener("wheel", blockWheel);
    armed = null;
  };

  const arm = (el: EventTarget | null) => {
    disarm();
    if (!isGuardedNumberInput(el)) return;
    armed = el;
    armed.addEventListener("wheel", blockWheel, { passive: false });
  };

  const onFocusIn = (e: FocusEvent) => arm(e.target);
  const onFocusOut = () => disarm();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (!isGuardedNumberInput(e.target)) return;
    // Not `stopPropagation`: a form-level key handler (Enter-to-save and the
    // like) still sees the event, it just does not reach the spinner.
    e.preventDefault();
  };

  // A field can already be focused when this runs — autofocus, or a re-install.
  arm(target.activeElement);

  target.addEventListener("focusin", onFocusIn);
  target.addEventListener("focusout", onFocusOut);
  target.addEventListener("keydown", onKeyDown);

  return () => {
    target.removeEventListener("focusin", onFocusIn);
    target.removeEventListener("focusout", onFocusOut);
    target.removeEventListener("keydown", onKeyDown);
    disarm();
  };
}
