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
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 z-10">
          {leftIcon}
        </div>
      )}
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 z-10">
          {rightIcon}
        </div>
      )}
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 py-2.5 pl-10 pr-10 text-stone-900 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 border-brand-500/50 transition-all disabled:cursor-not-allowed disabled:opacity-50',
          leftIcon && 'pl-11',
          rightIcon && 'pr-11',
          className
        )}
        {...props}
      />
    </div>
  )
)
Input.displayName = 'Input'

export default Input
