import Button from "./Button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

/** The green title bar from the legacy screens, carrying the page name in pale
 *  yellow with its primary action on the right. */
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6 rounded-lg bg-primary-800 px-5 py-3 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-titlebar truncate">{title}</h1>
        {subtitle && <p className="text-xs text-sage-100 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Button variant="light" onClick={action.onClick} className="shrink-0">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
