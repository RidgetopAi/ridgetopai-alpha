import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type PanelAccent = 'default' | 'primary' | 'gold' | 'purple' | 'success' | 'warning' | 'error';

interface PanelProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  accent?: PanelAccent;
  className?: string;
  headerActions?: ReactNode;
  animate?: boolean;
}

const accentStyles: Record<PanelAccent, string> = {
  default: 'border-border-default',
  primary: 'border-accent-primary/50',
  gold: 'border-accent-gold/50',
  purple: 'border-accent-purple/50',
  success: 'border-status-complete/50',
  warning: 'border-status-active/50',
  error: 'border-status-error/50',
};

export function Panel({
  children,
  title,
  subtitle,
  accent = 'default',
  className = '',
  headerActions,
  animate = true,
}: PanelProps) {
  const content = (
    <div
      className={`
        bg-surface-1 rounded-lg border ${accentStyles[accent]}
        ${className}
      `}
    >
      {(title || headerActions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div>
            {title && (
              <h3 className="text-sm font-medium text-text-primary">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {content}
    </motion.div>
  );
}
