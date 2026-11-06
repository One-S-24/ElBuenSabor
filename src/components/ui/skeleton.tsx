import * as React from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Bloque de carga con barrido animado. Usa `aria-hidden` por defecto. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton', className)} {...props} />
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
}

/** Varias líneas de texto simulado, con la última más corta. */
export function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)} {...props} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-2.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

/** Carga de una página del cliente mientras se descarga su chunk o sus datos. */
export function ClientRouteSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando contenido…</span>

      <div className="rounded-3xl bg-leaf-900 p-5 shadow-[var(--shadow-float)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-36 bg-white/15" />
          <Skeleton className="h-5 w-28 rounded-full bg-white/15" />
        </div>
        <Skeleton className="mt-6 h-9 w-56 max-w-full bg-white/15" />
        <Skeleton className="mt-3 h-3 w-72 max-w-full bg-white/10" />
        <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-28 bg-white/15" />
            <Skeleton className="h-8 w-32 bg-white/15" />
            <Skeleton className="h-2.5 w-40 bg-white/10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-2.5 w-20 bg-white/15" />
            <Skeleton className="ml-auto h-6 w-16 bg-white/15" />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="surface space-y-6 rounded-3xl p-5 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-52 max-w-full" />
          </div>
          {[0, 1].map((section) => (
            <div key={section} className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>

        <div className="surface space-y-4 rounded-3xl p-5 sm:p-6">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Carga genérica del panel de administración. */
export function AdminRouteSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando panel…</span>

      <div className="space-y-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      <div className="surface space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-1/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Carga de la pantalla de acceso mientras se descarga su chunk. */
export function AuthRouteSkeleton() {
  return (
    <div className="grid min-h-svh place-items-center px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando inicio de sesión…</span>
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="surface space-y-5 rounded-3xl p-6 sm:p-8">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-full" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
          <Skeleton className="h-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Pantalla completa para la restauración de sesión. */
export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-4 bg-brand-50"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-600 text-white shadow-[0_16px_32px_-18px_rgba(20,83,45,0.9)]">
        <UtensilsCrossed className="h-6 w-6" />
      </span>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-leaf-200 border-b-leaf-600" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</p>
    </div>
  )
}
