import * as React from 'react'
import { User } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** URL de la foto de perfil. Si falla o no existe, se muestra el icono. */
  src?: string
  /** Nombre de la persona, usado para accesibilidad y tooltip. */
  name?: string
  size?: 'sm' | 'default' | 'lg' | 'xl'
}

const sizes = {
  sm: 'h-8 w-8',
  default: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

const iconSizes = {
  sm: 'h-4 w-4',
  default: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name, size = 'default', ...props }, ref) => {
    const [failed, setFailed] = React.useState(false)

    React.useEffect(() => {
      setFailed(false)
    }, [src])

    const showImage = Boolean(src) && !failed

    return (
      <div
        ref={ref}
        title={name}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-leaf-100 bg-leaf-50 text-leaf-700',
          sizes[size],
          className,
        )}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={name ? `Foto de ${name}` : 'Foto de perfil'}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <User className={iconSizes[size]} aria-hidden="true" />
        )}
        <span className="sr-only">{name ?? 'Perfil'}</span>
      </div>
    )
  },
)
Avatar.displayName = 'Avatar'

export default Avatar
