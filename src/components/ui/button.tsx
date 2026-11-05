import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'brand'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-stone-900 text-white hover:bg-stone-800',
      destructive: 'bg-brand-600 text-white hover:bg-brand-700',
      outline: 'border border-stone-300 bg-white hover:bg-stone-50',
      ghost: 'hover:bg-stone-200',
      brand: 'bg-brand-600 text-white hover:bg-brand-700 shadow-md',
    }
    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3 py-1',
      lg: 'h-11 px-8 py-2',
    }
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none',
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
