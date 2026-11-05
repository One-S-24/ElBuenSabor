import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'leaf' | 'ember' | 'outline' | 'ghost' | 'stone'
  size?: 'sm' | 'default' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'leaf', size = 'default', ...props }, ref) => {
    const variants = {
      leaf: 'bg-leaf-600 text-white hover:bg-leaf-700 shadow-sm hover:shadow-md',
      ember: 'bg-ember-600 text-white hover:bg-ember-700 shadow-sm hover:shadow-md',
      outline: 'border border-stone-300 bg-white hover:bg-stone-50 text-stone-900',
      ghost: 'hover:bg-stone-100 text-stone-600',
      stone: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm hover:shadow-md',
    }
    const sizes = {
      sm: 'h-9 px-3 text-xs',
      default: 'h-10 px-4 py-2 text-sm',
      lg: 'h-11 px-6 py-3 text-base',
    }
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus-ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
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
