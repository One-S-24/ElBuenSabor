import * as React from 'react'
import { cn } from '../../lib/utils'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  size?: 'sm' | 'default' | 'lg'
}

const sizes = {
  sm: 'w-8 h-8',
  default: 'w-10 h-10',
  lg: 'w-12 h-12',
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, size = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full overflow-hidden border border-stone-200 bg-stone-100',
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt="Avatar"
          className="aspect-square w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-500 font-medium text-sm">
          {src?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      )}
    </div>
  )
)
Avatar.displayName = 'Avatar'

export default Avatar
