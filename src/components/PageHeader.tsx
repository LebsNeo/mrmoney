interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  gradient?: boolean;
}

export function PageHeader({ title, description, action, gradient = false }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className={`text-2xl font-bold leading-tight ${gradient ? "gradient-text" : "text-white"}`}>
          {title}
        </h1>
        {description && (
          <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0 ml-4">{action}</div>
      )}
    </div>
  );
}
