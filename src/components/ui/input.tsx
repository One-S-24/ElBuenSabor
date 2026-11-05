import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, ...props }, ref) => (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
          {leftIcon}
        </div>
      )}
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 border-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50',
          leftIcon && 'pl-10',
          className
        )}
        {...props}
      />
    </div>
  )
)
Input.displayName = 'Input'

export default Input
