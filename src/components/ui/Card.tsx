import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  /** Optional control rendered at the right of the title bar (e.g. a "New Item"
   *  button). Only shown when the card has a title. */
  action?: React.ReactNode;
}

/** A titled card reproduces the legacy form: a green header bar with pale
 *  yellow lettering over a sage panel. */
export default function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={cn("bg-sage-100 rounded-lg border border-sage-400 shadow-sm overflow-hidden", className)}>
      {title && (
        <div className="px-5 py-3 bg-primary-800 flex items-center justify-between gap-3">
          <h3 className="font-bold text-titlebar text-sm">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
