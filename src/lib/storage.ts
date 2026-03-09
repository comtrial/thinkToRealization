import { mkdir, writeFile, unlink, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = join(process.cwd(), '.devflow-uploads')

export async function saveFile(
  nodeId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const dir = join(UPLOAD_DIR, nodeId)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${nodeId}/${fileId}-${safeName}`
  await writeFile(join(UPLOAD_DIR, storagePath), buffer)
  return storagePath
}

export async function deleteFile(storagePath: string): Promise<void> {
  const fullPath = join(UPLOAD_DIR, storagePath)
  try {
    await unlink(fullPath)
  } catch {
    // File may already be deleted
  }
}

export async function getFile(storagePath: string): Promise<{ buffer: Buffer; exists: boolean }> {
  const fullPath = join(UPLOAD_DIR, storagePath)
  try {
    const buffer = await readFile(fullPath)
    return { buffer, exists: true }
  } catch {
    return { buffer: Buffer.alloc(0), exists: false }
  }
}

export async function getFileStats(storagePath: string) {
  const fullPath = join(UPLOAD_DIR, storagePath)
  return stat(fullPath)
}
