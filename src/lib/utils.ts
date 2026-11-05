import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function formatCurrency(amount: number): string {
  return `C$ ${formatMoney(amount)}`
}
