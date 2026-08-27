"use client";
import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  /** `disabled` greys an option out but keeps it listed, so a choice that is
   *  currently unavailable (e.g. an out-of-stock item) still shows why. */
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "size"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | number;
  /** Called with an event-shaped payload, so `e.target.value` reads the same
   *  whether this renders the native control or the searchable one. */
  onChange?: (event: { target: { value: string } }) => void;
  /** Force the type-to-filter box on or off. Left unset, a list long enough to
   *  need scrolling gets it, and a short one (Yes/No, a handful of pay modes)
   *  stays a plain native dropdown — quicker to use, and it still gives the OS
   *  picker on a touch terminal. */
  searchable?: boolean;
}

/** Lists this long or longer get the search box on their own. */
const SEARCHABLE_FROM = 8;
/** Height budget for the popup, so it can be flipped above a low trigger. */
const PANEL_MAX_H = 320;

/** `className` sizes the WRAPPER, not the control.
 *
 *  Callers pass layout classes — `w-48`, `col-span-2`, `flex-1` — and those have
 *  to land on the element the parent grid or flex row actually positions. Put on
 *  the control instead, `col-span-2` resolves against no grid at all and is
 *  dropped, which is how the Stock Adjustment item picker ended up one column
 *  wide with its headers shifted a column out of step. The control stays
 *  `w-full`, so it still fills whatever width the wrapper is given. */
const controlClass =
  "w-full rounded-md border border-sage-400 px-3 py-2 text-sm shadow-sm bg-white transition-colors focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800 disabled:bg-sage-100 disabled:cursor-not-allowed";

export default function Select({
  className, label, error, id, options, placeholder, value, onChange,
  searchable, disabled, name, ...props
}: SelectProps) {
  const useSearch = searchable ?? options.length >= SEARCHABLE_FROM;

  // Short list — the native control, exactly as it always was.
  if (!useSearch) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-primary-900">{label}</label>
        )}
        <select
          id={id}
          name={name}
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={cn(
            controlClass,
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <SearchableSelect
      className={className} label={label} error={error} id={id} options={options}
      placeholder={placeholder} value={value} onChange={onChange} disabled={disabled} name={name}
    />
  );
}

interface SearchableProps {
  className?: string;
  label?: string;
  error?: string;
  id?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  name?: string;
}

interface PanelBox { top: number; left: number; width: number; maxHeight: number }

/**
 * A dropdown you can type into — the customer, item and branch lists are far
 * too long to hunt through by eye.
 *
 * The popup is portalled to <body> and positioned from the trigger's rect
 * rather than sitting in the layout: Card and Modal both clip their overflow,
 * so an in-flow panel would be cut off exactly where these fields tend to live
 * (the last row of an invoice header). It re-measures on scroll and resize, and
 * flips above the field when there isn't room below.
 */
function SearchableSelect({
  className, label, error, id, options, placeholder, value, onChange, disabled, name,
}: SearchableProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [box, setBox] = useState<PanelBox | null>(null);
  const [mounted, setMounted] = useState(false);
  /** Ties the trigger to its portalled listbox for assistive tech. */
  const panelId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Portals need a DOM — nothing is rendered into one until after mount.
  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? "")),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const openUp = below < Math.min(PANEL_MAX_H, 220) && above > below;
    const maxHeight = Math.max(160, Math.min(PANEL_MAX_H, openUp ? above : below));
    setBox({
      top: openUp ? r.top - maxHeight - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }, []);

  // Re-measure while open: the field can move under a scrolling page, and a
  // panel left behind would be pointing at the wrong row.
  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const reposition = () => measure();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, measure]);

  // Close on an outside click. The panel is portalled, so "outside" has to be
  // judged against both the trigger and the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, filtered.length]);

  const openPanel = () => {
    if (disabled) return;
    setQuery("");
    const idx = selected ? options.findIndex((o) => String(o.value) === String(selected.value)) : 0;
    setActiveIndex(Math.max(0, idx));
    setOpen(true);
    // The search box is the point of the control — land the caret in it.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closePanel = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const pick = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange?.({ target: { value: String(opt.value) } });
    closePanel();
  };

  /** Steps the highlight, skipping options that can't be picked. */
  const move = (delta: number) => {
    if (!filtered.length) return;
    let next = activeIndex;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) pick(filtered[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        // A Modal closes on Escape too — the first press should only shut this.
        e.stopPropagation();
        closePanel();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const panel = box && (
    <div
      ref={panelRef}
      id={panelId}
      role="listbox"
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
      className="z-[60] flex flex-col overflow-hidden rounded-md border border-sage-400 bg-white shadow-lg"
    >
      <div className="relative border-b border-sage-200 p-2">
        <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          onKeyDown={onKeyDown}
          placeholder="Type to search…"
          className="w-full rounded border border-sage-300 py-1.5 pl-7 pr-2 text-sm focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800"
        />
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {/* The placeholder doubles as "clear the selection", the way picking the
            blank first option does on a native select. */}
        {placeholder && !query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange?.({ target: { value: "" } }); closePanel(); }}
            className="block w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-sage-100"
          >
            {placeholder}
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-gray-400">No matches for “{query}”</p>
        ) : (
          filtered.map((opt, i) => {
            const isSelected = String(opt.value) === String(value ?? "");
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={i === activeIndex}
                disabled={opt.disabled}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                onClick={() => pick(opt)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                  opt.disabled
                    ? "cursor-not-allowed text-gray-300"
                    : i === activeIndex
                      ? "bg-sage-200 text-primary-900"
                      : "text-gray-700 hover:bg-sage-100",
                  isSelected && !opt.disabled && "font-medium",
                )}
              >
                <Check size={13} className={cn("shrink-0", isSelected ? "text-primary-700" : "opacity-0")} />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-primary-900">{label}</label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? closePanel(false) : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          controlClass,
          "flex items-center justify-between gap-2 text-left",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
        )}
      >
        <span className={cn("truncate", selected ? "text-gray-900" : "text-gray-400")}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {/* Carries the value for anything reading the surrounding form natively. */}
      {name && <input type="hidden" name={name} value={value ?? ""} readOnly />}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
