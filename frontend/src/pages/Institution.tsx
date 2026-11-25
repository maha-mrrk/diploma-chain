import { useState } from 'react'
import { isAddress, ZeroAddress } from 'ethers'
import { useWallet } from '../context/useWallet'
import { hashFile, isPdf } from '../lib/hash'
import { uploadDiploma } from '../lib/api'
import { getContract, toWalletError, txUrl } from '../lib/contract'
import IssuedDiplomas from '../components/IssuedDiplomas'

type Step = 'idle' | 'uploading' | 'signing' | 'pending' | 'confirmed' | 'error'

export default function Institution() {
  const { session, roles } = useWallet()

  const [student, setStudent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [hash, setHash] = useState('')
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [mention, setMention] = useState('')
  const [studentName, setStudentName] = useState('')
  const [formKey, setFormKey] = useState(0)

  const [step, setStep] = useState<Step>('idle')
  const [message, setMessage] = useState('')
  const [txHash, setTxHash] = useState('')
  const [diplomaId, setDiplomaId] = useState('')

  const busy = step === 'uploading' || step === 'signing' || step === 'pending'

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(null)
    setHash('')
    if (!f) return
    if (!isPdf(f)) {
      setStep('error')
      setMessage('Le fichier doit être un PDF.')
      return
    }
    try {
      setHash(await hashFile(f))
      setFile(f)
      setStep('idle')
      setMessage('')
    } catch (err) {
      setStep('error')
      setMessage(err instanceof Error ? err.message : 'Erreur de hachage.')
    }
  }

  function validate(): string {
    const addr = student.trim()
    if (!isAddress(addr) || addr === ZeroAddress) return 'Adresse de l’étudiant invalide.'
    if (!file || !hash) return 'Sélectionnez un fichier PDF.'
    if (!title.trim()) return 'L’intitulé du diplôme est obligatoire.'
    if (!/^\d{4}$/.test(year)) return 'Année invalide (exemple : 2026).'
    return ''
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !file) return
    const problem = validate()
    if (problem) {
      setStep('error')
      setMessage(problem)
      return
    }
    setTxHash('')
    setDiplomaId('')

    try {
      const contract = getContract(session.signer, session.chainId)

      // 1. Éviter d'envoyer un PDF déjà enregistré (un hash n'est jamais réutilisable).
      if (await contract.hashExists(hash)) {
        throw new Error('Ce PDF est déjà enregistré on-chain (même hash).')
      }

      // 2. Envoi au serveur off-chain.
      setStep('uploading')
      setMessage('Envoi du PDF au serveur off-chain…')
      const up = await uploadDiploma(file, { title: title.trim(), year, mention, studentName })
      if (up.diplomaHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error('Le hash calculé par le serveur diffère du hash local.')
      }

      // 3. Transaction on-chain.
      setStep('signing')
      setMessage('Confirmez la transaction dans MetaMask…')
      const tx = await contract.issueDiploma(student.trim(), hash, up.metadataURI)
      setTxHash(tx.hash)
      setStep('pending')
      setMessage('Transaction envoyée, en attente de confirmation…')

      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('La transaction a échoué.')

      // 4. Récupérer l'identifiant du diplôme dans l'événement Issued.
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log)
          if (parsed?.name === 'Issued') {
            setDiplomaId(parsed.args.diplomaId.toString())
            break
          }
        } catch {
          // log d'un autre contrat : on l'ignore
        }
      }

      setStep('confirmed')
      setMessage('Diplôme émis avec succès.')
      setStudent('')
      setFile(null)
      setHash('')
      setTitle('')
      setYear('')
      setMention('')
      setStudentName('')
      setFormKey((k) => k + 1) // vide le champ fichier
    } catch (err) {
      setStep('error')
      setMessage(toWalletError(err).message)
    }
  }

  if (!session) {
    return (
      <section>
        <h1>Espace institution</h1>
        <p>Connectez votre wallet pour émettre des diplômes.</p>
      </section>
    )
  }
  if (!roles) {
    return (
      <section>
        <h1>Espace institution</h1>
        <p>Rôles indisponibles : vérifiez le réseau et le déploiement du contrat.</p>
      </section>
    )
  }
  if (!roles.isIssuer) {
    return (
      <section>
        <h1>Espace institution</h1>
        <p className="alert">
          Votre compte n’est pas un émetteur autorisé. Demandez à l’administrateur de vous
          ajouter.
        </p>
      </section>
    )
  }

  const explorer = txHash ? txUrl(session.chainId, txHash) : undefined

  return (
    <section>
      <h1>Émettre un diplôme</h1>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Adresse du wallet de l’étudiant *
          <input
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            placeholder="0x…"
            disabled={busy}
          />
        </label>

        <label className="field">
          Diplôme au format PDF *
          <input
            key={formKey}
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            disabled={busy}
          />
        </label>
        {hash && (
          <p className="hint">
            SHA-256 : <code>{hash}</code>
          </p>
        )}

        <label className="field">
          Intitulé du diplôme *
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </label>

        <div className="row">
          <label className="field">
            Année *
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
              inputMode="numeric"
              maxLength={4}
              disabled={busy}
            />
          </label>
          <label className="field">
            Mention
            <input value={mention} onChange={(e) => setMention(e.target.value)} disabled={busy} />
          </label>
        </div>

        <label className="field">
          Nom de l’étudiant (facultatif)
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            disabled={busy}
          />
          <span className="hint">
            Attention : les métadonnées sont lisibles publiquement via le metadataURI inscrit
            on-chain.
          </span>
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Émission en cours…' : 'Émettre le diplôme'}
        </button>
      </form>

      {message && (
        <p className={`status status-${step}`} role="status">
          {message}
        </p>
      )}
      {txHash && (
        <p className="hint">
          Transaction :{' '}
          {explorer ? (
            <a href={explorer} target="_blank" rel="noreferrer">
              {txHash}
            </a>
          ) : (
            <code>{txHash}</code>
          )}
        </p>
      )}
      {diplomaId && (
        <p className="hint">
          Identifiant du diplôme : <strong>{diplomaId}</strong>
        </p>
      )}
          <IssuedDiplomas refreshKey={formKey} />
    </section>
  )
}