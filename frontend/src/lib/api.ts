export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface DiplomaMetadata {
  title: string
  year: string
  mention?: string
  studentName?: string
}

export interface UploadResult {
  id: string
  diplomaHash: string
  metadataURI: string
}

/** Envoie le PDF et ses métadonnées au serveur off-chain (POST /upload). */
export async function uploadDiploma(file: File, meta: DiplomaMetadata): Promise<UploadResult> {
  const body = new FormData()
  body.append('pdf', file)
  for (const [key, value] of Object.entries(meta)) {
    if (value) body.append(key, value)
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}/upload`, { method: 'POST', body })
  } catch {
    throw new Error(`Serveur off-chain injoignable (${API_URL}). Est-il lancé ?`)
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Erreur du serveur (${res.status}).`)
  }
  return (await res.json()) as UploadResult
}