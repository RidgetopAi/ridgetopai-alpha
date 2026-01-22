import type { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-accent-primary text-surface-0
    hover:bg-accent-primary/90
    active:bg-accent-primary/80
    disabled:bg-accent-primary/50 disabled:cursor-not-allowed
  `,
  secondary: `
    bg-surface-3 text-text-primary border border-border-default
    hover:bg-surface-4 hover:border-border-strong
    active:bg-surface-3
    disabled:bg-surface-2 disabled:text-text-disabled disabled:cursor-not-allowed
  `,
  ghost: `
    bg-transparent text-text-secondary
    hover:bg-surface-2 hover:text-text-primary
    active:bg-surface-3
    disabled:text-text-disabled disabled:cursor-not-allowed
  `,
  danger: `
    bg-status-error text-white
    hover:bg-status-error/90
    active:bg-status-error/80
    disabled:bg-status-error/50 disabled:cursor-not-allowed
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
};

export function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  className = '',
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-md font-medium
        transition-colors duration-150
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
