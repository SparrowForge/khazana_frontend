import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `light` is for buttons that sit ON the green title bar, where the usual
   *  green-on-green primary would disappear. */
  variant?: "primary" | "secondary" | "danger" | "ghost" | "light";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-primary-800 text-white hover:bg-primary-700 focus:ring-primary-500",
      // Sage rather than grey, so a Cancel/Close reads as part of the panel.
      secondary: "bg-sage-300 text-primary-900 hover:bg-sage-400 focus:ring-sage-500",
      // The maroon of the legacy action bar's Close button.
      danger: "bg-accent-700 text-white hover:bg-accent-600 focus:ring-accent-500",
      ghost: "bg-transparent text-primary-900 hover:bg-sage-200 focus:ring-sage-500",
      light: "bg-sage-50 text-primary-900 hover:bg-white focus:ring-titlebar border border-sage-300",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
