import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, ...props }, ref) => (
    <div className="relative w-full">
      {leftIcon && (
        <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-stone-400">
          {leftIcon}
        </div>
      )}
      {rightIcon && (
        <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-stone-400">{rightIcon}</div>
      )}
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-all',
          'placeholder:text-stone-400 hover:border-stone-400',
          'focus:border-leaf-500 focus:outline-none focus:ring-4 focus:ring-leaf-500/15',
          'disabled:cursor-not-allowed disabled:bg-stone-50 disabled:opacity-60',
          leftIcon && 'pl-11',
          rightIcon && 'pr-11',
          className,
        )}
        {...props}
      />
    </div>
  ),
)
Input.displayName = 'Input'

export default Input
