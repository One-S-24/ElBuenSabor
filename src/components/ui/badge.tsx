import * as React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'info'
}

const variants = {
  default: 'border-stone-200 bg-stone-100 text-stone-600',
  success: 'border-leaf-200 bg-leaf-50 text-leaf-800',
  warning: 'border-ember-200 bg-ember-50 text-ember-700',
  error: 'border-ember-700 bg-ember-700 text-ember-50',
  brand: 'border-leaf-800 bg-leaf-700 text-white',
  info: 'border-leaf-200 bg-white text-leaf-800',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
)
Badge.displayName = 'Badge'

export default Badge
