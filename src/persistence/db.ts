import { del, get, getMany, keys, set } from 'idb-keyval'
import { ProjectSchema, type Project, type ProjectKind } from '../model/schema'

// I progetti sono salvati in IndexedDB (più capiente e robusto di localStorage).
const PREFIX = 'project:'
const LAST_KEY = 'banana33:lastProject'

export interface ProjectMeta {
  kind: ProjectKind
  id: string
  name: string
  updatedAt: number
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const ks = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
  const values = await getMany(ks)
  return values
    .map((v) => ProjectSchema.safeParse(v))
    .flatMap((r) => (r.success ? [{ kind: r.data.kind, id: r.data.id, name: r.data.name, updatedAt: r.data.updatedAt }] : []))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadProject(id: string): Promise<Project | null> {
  const r = ProjectSchema.safeParse(await get(PREFIX + id))
  return r.success ? r.data : null
}

export async function saveProject(p: Project) {
  await set(PREFIX + p.id, p)
  try {
    localStorage.setItem(LAST_KEY, p.id)
  } catch {
    // storage non disponibile: si perde solo il "riapri l'ultimo progetto"
  }
}

export async function deleteProject(id: string) {
  await del(PREFIX + id)
}

export function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}
