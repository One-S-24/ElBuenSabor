import * as React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand'
}

const variants = {
  default: 'border-stone-300 text-stone-800 bg-stone-100',
  success: 'border-emerald-200 text-emerald-800 bg-emerald-50',
  warning: 'border-amber-200 text-amber-800 bg-amber-50',
  error: 'border-rose-200 text-rose-800 bg-rose-50',
  brand: 'border-brand-200 text-brand-700 bg-brand-50',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export default Badge
