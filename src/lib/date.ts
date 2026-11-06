/**
 * Utilidades de fecha/hora para el negocio.
 *
 * El comedor opera en Nicaragua (America/Managua, UTC-6 sin horario de
 * verano). La base de datos guarda `timestamptz` en UTC y las columnas
 * `date` como fechas de calendario. Para evitar desfases de un día se
 * centraliza aquí el cálculo de "hoy", quincenas y rangos.
 */

export const ZONA_HORARIA = 'America/Managua'
export const OFFSET_MANAGUA = '-06:00'

function partesManagua(fecha: Date = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '00'

  return {
    year: Number(valor('year')),
    month: Number(valor('month')),
    day: Number(valor('day')),
    hour: Number(valor('hour')),
    minute: Number(valor('minute')),
  }
}

const pad = (valor: number) => String(valor).padStart(2, '0')

/** Fecha actual en Managua con formato YYYY-MM-DD. */
export function hoyManaguaISO(fecha: Date = new Date()): string {
  const { year, month, day } = partesManagua(fecha)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Minutos transcurridos del día en Managua (0..1439). */
export function minutosDelDiaManagua(fecha: Date = new Date()): number {
  const { hour, minute } = partesManagua(fecha)
  return hour * 60 + minute
}

/** Nombre del día actual en Managua. */
export function nombreDiaManagua(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-NI', {
    timeZone: ZONA_HORARIA,
    weekday: 'long',
  }).format(fecha)
}

/** Quincena actual (1-15 o 16-fin de mes) en Managua. */
export function quincenaActualManagua(fecha: Date = new Date()): {
  inicio: string
  fin: string
} {
  const { year, month, day } = partesManagua(fecha)
  const mes = pad(month)

  if (day <= 15) {
    return { inicio: `${year}-${mes}-01`, fin: `${year}-${mes}-15` }
  }

  // Último día del mes (UTC evita desfases al calcular).
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { inicio: `${year}-${mes}-16`, fin: `${year}-${mes}-${pad(ultimoDia)}` }
}

/** Suma días a una fecha YYYY-MM-DD sin usar la zona del navegador. */
export function sumarDiasISO(fecha: string, dias: number): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const resultado = new Date(Date.UTC(year, month - 1, day + dias))
  return resultado.toISOString().slice(0, 10)
}

/** Inicio del día local de Managua expresado como instante UTC. */
export function inicioDiaManaguaUTC(fecha: string): string {
  return `${fecha}T00:00:00${OFFSET_MANAGUA}`
}

/** Inicio del día siguiente (límite exclusivo) en Managua. */
export function finDiaManaguaUTC(fecha: string): string {
  return inicioDiaManaguaUTC(sumarDiasISO(fecha, 1))
}

/**
 * Formatea una fecha de calendario (columna `date` o "YYYY-MM-DD").
 * Se interpreta como fecha pura para no retroceder un día al aplicar
 * la zona horaria local.
 */
export function formatearFechaISO(
  valor: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = {},
): string {
  if (!valor) return ''
  const [year, month, day] = valor.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return valor

  return new Intl.DateTimeFormat('es-NI', {
    timeZone: 'UTC',
    ...opciones,
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** Formatea un `timestamptz` en la hora local de Managua. */
export function formatearHoraManagua(
  valor: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = {},
): string {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor

  return new Intl.DateTimeFormat('es-NI', {
    timeZone: ZONA_HORARIA,
    ...opciones,
  }).format(fecha)
}

/** Formatea una hora de 24 h a formato 12 h (p. ej. "1:30 p. m."). */
export function formatearHora12(hora: string): string {
  const [horas, minutos] = hora.split(':').map(Number)
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return hora

  const sufijo = horas >= 12 ? 'p. m.' : 'a. m.'
  const hora12 = horas % 12 === 0 ? 12 : horas % 12
  return `${hora12}:${String(minutos).padStart(2, '0')} ${sufijo}`
}

/** Formatea fecha y hora de un `timestamptz` en Managua. */
export function formatearFechaHoraManagua(
  valor: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = {},
): string {
  return formatearHoraManagua(valor, {
    dateStyle: 'short',
    timeStyle: 'short',
    ...opciones,
  })
}
