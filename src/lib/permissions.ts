// Mapa de permisos por módulo. La seguridad real es RLS en la base de datos; esto decide qué ve cada rol en la interfaz.
import type { Role } from '@/lib/types'

export type Module =
  | 'dashboard' | 'people' | 'access' | 'bookings' | 'billing' | 'gym'
  | 'sections' | 'comms' | 'reports' | 'audit' | 'settings'

export const STAFF_ROLES: Role[] = ['admin', 'board', 'reception', 'trainer', 'coordinator', 'coach']

/** read = solo consulta; write = puede modificar. */
export const PERMISSIONS: Record<Module, Partial<Record<Role, 'read' | 'write'>>> = {
  dashboard: { admin: 'write', board: 'read', reception: 'write', trainer: 'read' },
  people: { admin: 'write', board: 'read', reception: 'write' },
  access: { admin: 'write', board: 'read', reception: 'write' },
  bookings: { admin: 'write', board: 'read', reception: 'write' },
  billing: { admin: 'write', board: 'read', reception: 'write' },
  gym: { admin: 'write', trainer: 'write' },
  sections: { admin: 'write', board: 'read', coordinator: 'write', coach: 'write' },
  comms: { admin: 'write', board: 'read', reception: 'write' },
  reports: { admin: 'write', board: 'read' },
  audit: { admin: 'read', board: 'read' },
  settings: { admin: 'write' },
}

export const can = (role: Role, m: Module) => Boolean(PERMISSIONS[m][role])
export const canWrite = (role: Role, m: Module) => PERMISSIONS[m][role] === 'write'
export const isStaff = (role: Role) => STAFF_ROLES.includes(role)

/** Página de inicio del panel según rol. */
export function homeFor(role: Role): string {
  if (role === 'member') return '/app'
  if (role === 'coordinator' || role === 'coach') return '/admin/seccions'
  return '/admin'
}
