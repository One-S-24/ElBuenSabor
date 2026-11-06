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
import { Plus, Trash2, Save, Utensils } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Button from '../components/ui/button'
import Input from '../components/ui/input'
import Badge from '../components/ui/badge'

function cnSwitch(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
function cnSwitchKnob(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
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
      <Save className="w-4 h-4 animate-spin mr-2" />
      Guardando...
    </>
  ) : (
    <>
      <Save className="w-4 h-4 mr-2" />
      Guardar menú
    </>
  );

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
      setNuevo({ nombre: '', descripcion: '', precio_unitario: '', porciones_disponibles: '', tipo: 'principal' })
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
      <div className="flex h-[60svh] items-center justify-center bg-brand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Utensils className="h-5 w-5 shrink-0 text-leaf-700" />
          <h2 className="min-w-0 truncate text-leaf-900 font-serif">Gestión de menú diario</h2>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate('/admin/pedidos')}>
          Ver pedidos del día
        </Button>
      </div>

      {/* Datos del menú */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="text-leaf-900 font-serif">Datos del menú</CardTitle>
          <p className="text-[11px] text-stone-500 mt-1">Configura la fecha, hora de corte y estado del menú.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-stone-600 tracking-wider">Fecha</label>
            <Input type="date" value={menuFecha} onChange={(e) => setMenuFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-stone-600 tracking-wider">Hora de corte</label>
            <Input type="time" value={menuHora} onChange={(e) => setMenuHora(e.target.value)} />
          </div>
          <div className="space-y-2 flex items-end">
            <label className="text-[11px] font-semibold text-stone-600 tracking-wider">Activo</label>
            <button
              onClick={() => setMenuActivo((a) => !a)}
              className={cnSwitch(
                'relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-leaf-500',
                menuActivo ? 'bg-leaf-600' : 'bg-stone-300'
              )}
              aria-label="Activar/desactivar menú"
            >
              <span
                className={cnSwitchKnob(
                  'block rounded-full h-4 w-4 transform transition-transform shadow',
                  menuActivo ? 'translate-x-6 bg-white' : 'translate-x-1 bg-stone-900'
                )}
              />
            </button>
          </div>
          <Button variant="leaf" onClick={guardarMenu} disabled={saving} className="col-span-1 w-full sm:col-span-2 lg:col-span-3">
            {btnGuardarContent}
          </Button>
        </CardContent>
      </Card>

      {/* Platillos */}
      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-leaf-900 font-serif">Platillos del menú</CardTitle>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{platillos.length} platillo(s)</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {platillos.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-stone-500 text-sm">Aún no hay platillos. Agrega uno abajo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {platillos.map((p) => {
                const editando = editingId === p.id
                const v = editValues[p.id] ?? { ...p }
                return (
                  <div key={p.id} className="border border-stone-100 rounded-lg p-4">
                    {editando ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
                        <Input
                          value={v.nombre}
                          onChange={(e) => setEditValues({ ...editValues, [p.id]: { ...v, nombre: e.target.value } })}
                        />
                        <Input
                          value={v.precio_unitario}
                          onChange={(e) => setEditValues({ ...editValues, [p.id]: { ...v, precio_unitario: e.target.value } })}
                        />
                        <Input
                          value={v.porciones_disponibles}
                          onChange={(e) => setEditValues({ ...editValues, [p.id]: { ...v, porciones_disponibles: e.target.value } })}
                        />
                        <div className="flex gap-2">
                          <Button variant="leaf" size="sm" onClick={() => guardarEdicion(p.id)}>
                            Guardar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-900">{p.nombre}</span>
                          {p.descripcion && (
                            <span className="mt-0.5 block break-words text-[11px] text-stone-500">{p.descripcion}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-leaf-700">
                            {formatCurrency(p.precio_unitario)}
                          </span>
                          <Badge variant="default" className="px-2 py-0.5 text-[10px]">
                            {p.tipo}
                          </Badge>
                          <span className="text-[11px] text-stone-400">Stock: {p.porciones_disponibles}</span>
                        </div>
                        <div className="flex gap-2 sm:gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => {
                              setEditValues({ ...editValues, [p.id]: { ...p } })
                              setEditingId(p.id)
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Eliminar ${p.nombre}`}
                            onClick={() => borrarPlatillo(p.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-4 border-t border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-leaf-600" /> Agregar platillo
            </h3>
            <form onSubmit={handleNuevoPlatillo} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Input
                placeholder="Nombre"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              />
              <Input
                placeholder="Precio"
                value={nuevo.precio_unitario}
                onChange={(e) => setNuevo({ ...nuevo, precio_unitario: e.target.value })}
              />
              <Input
                placeholder="Porciones"
                value={nuevo.porciones_disponibles}
                onChange={(e) => setNuevo({ ...nuevo, porciones_disponibles: e.target.value })}
              />
              <select
                value={nuevo.tipo}
                onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-leaf-500 text-sm"
              >
                <option value="principal">Principal</option>
                <option value="bebida">Bebida</option>
                <option value="adicional">Adicional</option>
              </select>
              <Button variant="leaf" type="submit" className="w-full sm:col-span-2 lg:col-span-2">
                Agregar
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
