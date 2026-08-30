"use client";
import { cn, formatDate } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const CONTROL =
  "w-full rounded-md border border-sage-400 px-3 py-2 text-sm shadow-sm bg-white transition-colors placeholder:text-gray-400 focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800 disabled:bg-sage-100 disabled:cursor-not-allowed";

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, onFocus, onBlur, onChange, ...props }, ref) => {
    /**
     * A native date field renders its text in the BROWSER's locale — 29/08/2026
     * on one machine, 08/29/2026 on the next, whatever the operator's PC is set
     * to. Every date in this system reads DD-MMM-YYYY, so while the field is not
     * being edited its own text is hidden and the formatted value is painted
     * over it.
     *
     * Focus hands the native segmented editor straight back, so typing, the
     * calendar picker, min/max and keyboard entry are all untouched — only the
     * resting appearance changes. The value itself is still the `YYYY-MM-DD`
     * every caller reads off `e.target.value`.
     */
    const isDate = type === "date";
    const [focused, setFocused] = useState(false);
    // The overlay needs the current value, which an uncontrolled field does not
    // hand us — so track what was typed as well as what was passed in.
    const [typedValue, setTypedValue] = useState("");
    const current = props.value !== undefined ? String(props.value ?? "") : typedValue;
    const overlaid = isDate && !focused;

    const control = (
      <input
        ref={ref}
        id={id}
        type={type}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        onChange={(e) => { if (isDate) setTypedValue(e.target.value); onChange?.(e); }}
        className={cn(
          CONTROL,
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          // Only the text goes; the calendar indicator is a background image and
          // is left alone, so the picker still looks and works like the native one.
          overlaid && "text-transparent",
          className
        )}
        {...props}
      />
    );

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-primary-900">
            {label}
          </label>
        )}
        {isDate ? (
          <div className="relative">
            {control}
            {overlaid && (
              // aria-hidden: the input still carries the real value for a screen
              // reader, this is only what the eye sees.
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm",
                  current ? "text-gray-900" : "text-gray-400"
                )}
              >
                {current ? formatDate(current) : "DD-MMM-YYYY"}
              </span>
            )}
          </div>
        ) : (
          control
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
