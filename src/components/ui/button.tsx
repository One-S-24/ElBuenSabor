import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'leaf' | 'ember' | 'outline' | 'ghost' | 'stone'
  size?: 'sm' | 'default' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'leaf', size = 'default', ...props }, ref) => {
    const variants = {
      leaf: 'bg-leaf-700 text-white shadow-[0_10px_24px_-14px_rgba(20,83,45,0.9)] hover:bg-leaf-800 hover:shadow-[0_14px_30px_-14px_rgba(20,83,45,0.85)]',
      ember:
        'bg-ember-600 text-white shadow-[0_10px_24px_-14px_rgba(124,45,18,0.9)] hover:bg-ember-700 hover:shadow-[0_14px_30px_-14px_rgba(124,45,18,0.85)]',
      outline:
        'border border-stone-300 bg-white text-stone-800 shadow-[0_1px_2px_rgba(28,25,23,0.05)] hover:border-leaf-300 hover:bg-leaf-50 hover:text-leaf-800',
      ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
      stone: 'bg-stone-900 text-white shadow-[0_10px_24px_-14px_rgba(28,25,23,0.9)] hover:bg-stone-800',
    }
    const sizes = {
      sm: 'h-9 gap-1.5 px-3.5 text-xs',
      default: 'h-11 gap-2 px-5 text-sm',
      lg: 'h-12 gap-2.5 px-7 text-base',
    }
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex select-none items-center justify-center rounded-full font-semibold tracking-tight transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-50',
          'active:translate-y-px active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export default Button
