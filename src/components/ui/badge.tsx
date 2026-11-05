import * as React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'info'
}

const variants = {
  default: 'border-stone-200 text-stone-700 bg-stone-50',
  success: 'border-emerald-100 text-emerald-700 bg-emerald-50',
  warning: 'border-amber-100 text-amber-700 bg-amber-50',
  error: 'border-rose-100 text-rose-700 bg-rose-50',
  brand: 'border-leaf-100 text-leaf-700 bg-leaf-50',
  info: 'border-blue-100 text-blue-700 bg-blue-50',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export default Badge
