import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMenusHoy,
  getPlatillosPorMenu,
  crearMenu,
  actualizarMenu,
  guardarPlatillo,
  eliminarPlatillo,
} from '../services/adminService'
import { formatCurrency } from '../lib/utils'
import { Plus, Trash2, Save, Utensils, UtensilsCrossed, Coffee, ListChecks, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'
import Badge from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { cn } from '../lib/utils'

const tipos = [
  { value: 'principal', label: 'Principal' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'adicional', label: 'Adicional' },
]

function tipoBadge(tipo: string) {
  if (tipo === 'principal') return 'brand'
  if (tipo === 'bebida') return 'warning'
  return 'default'
}

export default function AdminMenu() {
  const navigate = useNavigate()
  const [menu, setMenu] = useState<any>(null)
  const [platillos, setPlatillos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [menuFecha, setMenuFecha] = useState('')
  const [menuHora, setMenuHora] = useState('11:00:00')
  const [menuActivo, setMenuActivo] = useState(true)

  const [nuevo, setNuevo] = useState<{
    nombre: string
    descripcion: string
    precio_unitario: string
    porciones_disponibles: string
    tipo: string
  }>({
    nombre: '',
    descripcion: '',
    precio_unitario: '',
    porciones_disponibles: '',
    tipo: 'principal',
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})

  useEffect(() => {
    let mounted = true
    const cargar = async () => {
      try {
        setLoading(true)
        const menus = await getMenusHoy()
        if (mounted) {
          setMenu(menus[0] ?? null)
          if (menus[0]) {
            setMenuFecha(menus[0].fecha)
            setMenuHora(menus[0].hora_limite_pedido)
            setMenuActivo(menus[0].activo)
            const ps = await getPlatillosPorMenu(menus[0].id)
            setPlatillos(ps)
          }
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    cargar()
    return () => {
      mounted = false
    }
  }, [])

  const btnGuardarContent = saving ? (
    <>
      <Save className="h-4 w-4 animate-spin" />
      Guardando...
    </>
  ) : (
    <>
      <Save className="h-4 w-4" />
      Guardar menú
    </>
  )

  const guardarMenu = async () => {
    setSaving(true)
    try {
      if (menu) {
        await actualizarMenu(menu.id, menuFecha, menuHora, menuActivo)
      } else {
        const creado = await crearMenu(menuFecha, menuHora)
        setMenu(creado)
        setMenuActivo(creado.activo)
      }
    } catch (err: any) {
      alert(err.message || 'No se pudo guardar el menú')
    } finally {
      setSaving(false)
    }
  }

  const handleNuevoPlatillo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!menu) return
    try {
      await guardarPlatillo({
        menu_id: menu.id,
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion || null,
        precio_unitario: parseFloat(nuevo.precio_unitario) || 0,
        porciones_disponibles: parseInt(nuevo.porciones_disponibles) || 0,
        tipo: nuevo.tipo as 'principal' | 'bebida' | 'adicional',
      })
      setNuevo({
        nombre: '',
        descripcion: '',
        precio_unitario: '',
        porciones_disponibles: '',
        tipo: 'principal',
      })
      const ps = await getPlatillosPorMenu(menu.id)
      setPlatillos(ps)
    } catch (err: any) {
      alert(err.message || 'No se pudo agregar el platillo')
    }
  }

  const guardarEdicion = async (id: string) => {
    const v = editValues[id]
    try {
      await guardarPlatillo({
        id,
        menu_id: menu!.id,
        nombre: v.nombre,
        descripcion: v.descripcion || null,
        precio_unitario: parseFloat(v.precio_unitario) || 0,
        porciones_disponibles: parseInt(v.porciones_disponibles) || 0,
        tipo: v.tipo as 'principal' | 'bebida' | 'adicional',
      })
      setEditingId(null)
      const ps = await getPlatillosPorMenu(menu!.id)
      setPlatillos(ps)
    } catch (err: any) {
      alert(err.message || 'No se pudo actualizar el platillo')
    }
  }

  const borrarPlatillo = async (id: string) => {
    if (!confirm('¿Eliminar este platillo del menú?')) return
    try {
      await eliminarPlatillo(id)
      const ps = await getPlatillosPorMenu(menu!.id)
      setPlatillos(ps)
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el platillo')
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando menú…</span>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>

        <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
          <Skeleton className="h-11 rounded-full" />
        </div>

        <div className="surface space-y-3 rounded-2xl p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3.5">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const principales = platillos.filter((p) => p.tipo === 'principal').length

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="text-stone-900">Menú del día</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Publica el menú, controla la hora de corte y administra los platillos.
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate('/admin/pedidos')}>
          <ListChecks className="h-4 w-4" />
          Ver pedidos del día
        </Button>
      </div>

      {/* Datos del menú */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Configuración del menú</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">
              Define la fecha, la hora límite de pedido y si está visible.
            </p>
          </div>
          <Badge variant={menuActivo ? 'success' : 'default'} className="mt-0.5 shrink-0">
            {menuActivo ? 'Activo' : 'Inactivo'}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="menu-fecha">Fecha</label>
            <Input
              id="menu-fecha"
              type="date"
              value={menuFecha}
              onChange={(e) => setMenuFecha(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="menu-hora">Hora de corte</label>
            <Input
              id="menu-hora"
              type="time"
              value={menuHora}
              onChange={(e) => setMenuHora(e.target.value)}
            />
          </div>
          <div>
            <label>Estado</label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-stone-200 bg-white px-3.5">
              <button
                type="button"
                role="switch"
                aria-checked={menuActivo}
                aria-label="Activar o desactivar menú"
                onClick={() => setMenuActivo((a) => !a)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf-500/20',
                  menuActivo ? 'bg-leaf-600' : 'bg-stone-300',
                )}
              >
                <span
                  className={cn(
                    'block h-4 w-4 rounded-full bg-white shadow transition-transform',
                    menuActivo ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
              <span className="text-xs font-medium text-stone-600">
                {menuActivo ? 'Visible para clientes' : 'Oculto temporalmente'}
              </span>
            </div>
          </div>
          <Button
            variant="leaf"
            onClick={guardarMenu}
            disabled={saving}
            className="w-full sm:col-span-2 lg:col-span-3"
          >
            {btnGuardarContent}
          </Button>
        </CardContent>
      </Card>

      {/* Platillos */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Platillos del menú</CardTitle>
            <p className="mt-1.5 text-sm text-stone-500">
              {principales} principal(es) · {platillos.length} en total
            </p>
          </div>
          <Badge variant="default" className="mt-0.5 shrink-0">
            {platillos.length} platillo(s)
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {platillos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-10 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 text-stone-300" />
              <p className="text-sm font-medium text-stone-600">
                Aún no hay platillos. Agrega uno abajo.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {platillos.map((p) => {
                const editando = editingId === p.id
                const v = editValues[p.id] ?? { ...p }
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-2xl border p-3.5 transition-colors sm:p-4',
                      editando
                        ? 'border-leaf-300 bg-leaf-50/40'
                        : 'border-stone-200/80 bg-white/60 hover:border-stone-300',
                    )}
                  >
                    {editando ? (
                      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        <div>
                          <label className="text-[11px]">Nombre</label>
                          <Input
                            aria-label="Nombre del platillo"
                            value={v.nombre}
                            onChange={(e) =>
                              setEditValues({ ...editValues, [p.id]: { ...v, nombre: e.target.value } })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[11px]">Precio</label>
                          <Input
                            aria-label="Precio del platillo"
                            value={v.precio_unitario}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                [p.id]: { ...v, precio_unitario: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[11px]">Porciones</label>
                          <Input
                            aria-label="Porciones disponibles"
                            value={v.porciones_disponibles}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                [p.id]: { ...v, porciones_disponibles: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="leaf" size="sm" onClick={() => guardarEdicion(p.id)}>
                            <Save className="h-3.5 w-3.5" /> Guardar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            p.tipo === 'bebida'
                              ? 'bg-ember-50 text-ember-600'
                              : 'bg-leaf-50 text-leaf-700',
                          )}
                          aria-hidden="true"
                        >
                          {p.tipo === 'bebida' ? (
                            <Coffee className="h-4 w-4" />
                          ) : (
                            <Utensils className="h-4 w-4" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-stone-900">
                              {p.nombre}
                            </span>
                            <Badge variant={tipoBadge(p.tipo) as any}>{p.tipo}</Badge>
                          </div>
                          {p.descripcion && (
                            <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-relaxed text-stone-500">
                              {p.descripcion}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-stone-400">
                            Stock: {p.porciones_disponibles} porción(es)
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="font-serif text-lg font-bold text-leaf-700">
                            {formatCurrency(p.precio_unitario)}
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Editar ${p.nombre}`}
                              onClick={() => {
                                setEditValues({ ...editValues, [p.id]: { ...p } })
                                setEditingId(p.id)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Eliminar ${p.nombre}`}
                              className="text-stone-400 hover:bg-ember-50 hover:text-ember-700"
                              onClick={() => borrarPlatillo(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-leaf-600 text-white">
                <Plus className="h-3.5 w-3.5" />
              </span>
              Agregar platillo
            </h3>
            <form onSubmit={handleNuevoPlatillo} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="nuevo-nombre" className="text-[11px]">
                  Nombre
                </label>
                <Input
                  id="nuevo-nombre"
                  placeholder="Pollo a la plancha"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="nuevo-precio" className="text-[11px]">
                  Precio
                </label>
                <Input
                  id="nuevo-precio"
                  placeholder="85"
                  value={nuevo.precio_unitario}
                  onChange={(e) => setNuevo({ ...nuevo, precio_unitario: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="nuevo-porciones" className="text-[11px]">
                  Porciones
                </label>
                <Input
                  id="nuevo-porciones"
                  placeholder="20"
                  value={nuevo.porciones_disponibles}
                  onChange={(e) => setNuevo({ ...nuevo, porciones_disponibles: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px]">Tipo</label>
                <div className="flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
                  {tipos.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNuevo({ ...nuevo, tipo: t.value })}
                      aria-pressed={nuevo.tipo === t.value}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
                        nuevo.tipo === t.value
                          ? 'bg-leaf-700 text-white'
                          : 'text-stone-500 hover:bg-stone-100',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label htmlFor="nuevo-desc" className="text-[11px]">
                  Descripción <span className="font-normal text-stone-400">(opcional)</span>
                </label>
                <Input
                  id="nuevo-desc"
                  placeholder="Acompañado de arroz y ensalada"
                  value={nuevo.descripcion}
                  onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
                />
              </div>
              <Button variant="leaf" type="submit" className="w-full sm:col-span-2 lg:col-span-4">
                <Plus className="h-4 w-4" /> Agregar platillo
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
