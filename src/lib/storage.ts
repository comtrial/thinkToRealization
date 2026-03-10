import { mkdir, writeFile, unlink, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// --- Supabase Storage (production) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'attachments'

function isSupabaseStorage(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY)
}

let _supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null

async function getSupabase() {
  if (_supabase) return _supabase
  const { createClient } = await import('@supabase/supabase-js')
  _supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  })
  return _supabase
}

// --- Local file system (development) ---
const UPLOAD_DIR = join(process.cwd(), '.devflow-uploads')

// --- Unified API ---

export async function saveFile(
  nodeId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${nodeId}/${fileId}-${safeName}`

  if (isSupabaseStorage()) {
    const supabase = await getSupabase()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: guessMime(fileName),
        upsert: true,
      })
    if (error) throw new Error(`Supabase upload failed: ${error.message}`)
    return storagePath
  }

  // Local filesystem
  const dir = join(UPLOAD_DIR, nodeId)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(join(UPLOAD_DIR, storagePath), buffer)
  return storagePath
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (isSupabaseStorage()) {
    const supabase = await getSupabase()
    await supabase.storage.from(BUCKET).remove([storagePath])
    return
  }

  const fullPath = join(UPLOAD_DIR, storagePath)
  try {
    await unlink(fullPath)
  } catch {
    // File may already be deleted
  }
}

export async function getFile(storagePath: string): Promise<{ buffer: Buffer; exists: boolean }> {
  if (isSupabaseStorage()) {
    const supabase = await getSupabase()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath)
    if (error || !data) return { buffer: Buffer.alloc(0), exists: false }
    const arrayBuffer = await data.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), exists: true }
  }

  const fullPath = join(UPLOAD_DIR, storagePath)
  try {
    const buf = await readFile(fullPath)
    return { buffer: buf, exists: true }
  } catch {
    return { buffer: Buffer.alloc(0), exists: false }
  }
}

export async function getFileStats(storagePath: string) {
  if (isSupabaseStorage()) {
    // Supabase doesn't have a direct stat API, return minimal info
    const { buffer, exists } = await getFile(storagePath)
    if (!exists) throw new Error('File not found')
    return { size: buffer.length }
  }

  const fullPath = join(UPLOAD_DIR, storagePath)
  return stat(fullPath)
}

// --- Helpers ---

function guessMime(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return map[ext] || 'application/octet-stream'
}
