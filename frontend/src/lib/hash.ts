/**
 * Calcule le hash SHA-256 d'un fichier côté client (Web Crypto API).
 * Retourne une chaîne "0x" + 64 caractères hexadécimaux, au format bytes32
 * attendu par le smart contract (DiplomaRegistry).
 */
export async function hashFile(file: File | Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto indisponible : utilisez HTTPS ou localhost pour calculer le hash.",
    )
  }
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bytesToHex(new Uint8Array(digest))
}

/** Convertit un tableau d'octets en chaîne hexadécimale préfixée par 0x. */
export function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Vérifie qu'une chaîne est un bytes32 valide (0x + 64 caractères hexa). */
export function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/** Vérifie que le fichier est bien un PDF (type MIME ou extension). */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}