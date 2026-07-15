/**
 * A centred "nothing here yet" placeholder: an optional icon, a title, an optional
 * description, and an optional action. The container/title/description classes can
 * each be overridden so call sites keep their exact look while sharing the
 * skeleton. (The dashboard's boxed-icon empty state and the mono shopping-list one
 * use different skeletons and keep their own markup.)
 */
const BASE = "flex flex-col items-center justify-center text-center";

export function EmptyState({
  className,
  icon,
  title,
  titleClassName = "text-[12px] font-semibold text-slate-500",
  description,
  descriptionClassName = "text-[11px] text-slate-400",
  action,
}: {
  className?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={className ? `${BASE} ${className}` : BASE}>
      {icon}
      <p className={titleClassName}>{title}</p>
      {description != null && (
        <p className={descriptionClassName}>{description}</p>
      )}
      {action}
    </div>
  );
}
