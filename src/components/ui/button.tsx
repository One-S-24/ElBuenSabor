import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'brand' | 'brand-outline'
  size?: 'default' | 'sm' | 'lg' | 'xl'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm hover:shadow-md',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm hover:shadow-md',
      outline: 'border border-stone-200 bg-white hover:bg-stone-50 text-stone-900',
      ghost: 'hover:bg-stone-100 text-stone-600',
      brand: 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand/20 hover:shadow-brand/30',
      'brand-outline': 'border border-brand-200 bg-white text-brand-700 hover:bg-brand-50',
    }
    const sizes = {
      sm: 'h-8 px-3 text-xs',
      default: 'h-10 px-4 py-2 text-sm',
      lg: 'h-11 px-6 py-3 text-base',
      xl: 'h-12 px-8 py-3 text-lg',
    }
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus-ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export default Button
