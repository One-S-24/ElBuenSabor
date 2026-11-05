import * as React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'raised'
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = 'default', ...props }, ref) => {
  const base = 'bg-white border border-stone-200'
  const variants = {
    default: 'rounded-lg shadow-sm',
    bordered: 'rounded-none border-b border-stone-200 shadow-none',
    raised: 'rounded-xl shadow-md',
  }
  return (
    <div
      ref={ref}
      className={cn(base, variants[variant], className)}
      {...props}
    />
  )
})
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1 p-6', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-stone-900 font-serif', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-stone-600', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center justify-between p-6 pt-0 border-t border-stone-100', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription }
