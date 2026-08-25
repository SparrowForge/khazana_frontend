import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

/** A titled card reproduces the legacy form: a green header bar with pale
 *  yellow lettering over a sage panel. */
export default function Card({ children, className, title }: CardProps) {
  return (
    <div className={cn("bg-sage-100 rounded-lg border border-sage-400 shadow-sm overflow-hidden", className)}>
      {title && (
        <div className="px-5 py-3 bg-primary-800">
          <h3 className="font-bold text-titlebar text-sm">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
