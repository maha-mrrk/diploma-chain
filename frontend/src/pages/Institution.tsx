import { useState } from 'react'
import { hashFile, isPdf } from '../lib/hash'

export default function Institution() {
  const [hash, setHash] = useState<string>('')
  const [error, setError] = useState<string>('')

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setHash('')
    setError('')
    if (!file) return
    if (!isPdf(file)) {
      setError('Le fichier doit être un PDF.')
      return
    }
    try {
      setHash(await hashFile(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de hachage.')
    }
  }

  return (
    <section>
      <h1>Espace institution</h1>
      <input type="file" accept="application/pdf" onChange={onFileChange} />
      {hash && <p>SHA-256 : <code style={{ wordBreak: 'break-all' }}>{hash}</code></p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
    </section>
  )
}