import { nanoid } from 'nanoid'
import { parseProject, type Project } from '../model/schema'

export const FILE_EXT = '.b33.json'

/** Fa scaricare un file al browser */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadProject(p: Project) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
  downloadBlob(blob, (p.name.trim().replace(/[^\w\-]+/g, '_') || 'progetto') + FILE_EXT)
}

/** Legge e valida un file di progetto; assegna un nuovo id per non sovrascrivere progetti esistenti */
export async function readProjectFile(file: File): Promise<Project> {
  const data = JSON.parse(await file.text())
  const p = parseProject(data)
  return { ...p, id: nanoid(), updatedAt: Date.now() }
}
