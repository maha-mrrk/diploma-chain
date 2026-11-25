import { useCallback, useEffect, useState } from 'react'
import {
  isAddress,
  ZeroAddress,
  type ContractTransactionResponse,
  type EventLog,
} from 'ethers'
import { useWallet } from '../context/useWallet'
import { getContract, toWalletError, txUrl } from '../lib/contract'
import { getDeploymentBlock } from '../lib/config'
import { REVOCATION_REASONS, STATUS } from '../lib/enums'

interface IssuerRow {
  address: string
  active: boolean
}

function validAddress(value: string): boolean {
  const v = value.trim()
  return isAddress(v) && v !== ZeroAddress
}

function short(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export default function Admin() {
  const { session, roles } = useWallet()

  const [issuers, setIssuers] = useState<IssuerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error'>('ok')
  const [txHash, setTxHash] = useState('')

  const [newIssuer, setNewIssuer] = useState('')
  const [oldIssuer, setOldIssuer] = useState('')
  const [replacement, setReplacement] = useState('')
  const [bulkIssuer, setBulkIssuer] = useState('')
  const [bulkReason, setBulkReason] = useState<number>(REVOCATION_REASONS[0].value)
  const [diplomaId, setDiplomaId] = useState('')
  const [singleReason, setSingleReason] = useState<number>(REVOCATION_REASONS[0].value)

  const isOwner = !!roles?.isOwner

  const loadIssuers = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const contract = getContract(session.provider, session.chainId)
      const events = await contract.queryFilter(
        contract.filters.IssuerAdded(),
        getDeploymentBlock(session.chainId),
      )
      const addresses = [...new Set(events.map((ev) => (ev as EventLog).args.issuer as string))]
      const rows = await Promise.all(
        addresses.map(
          async (address): Promise<IssuerRow> => ({
            address,
            active: (await contract.authorizedIssuers(address)) as boolean,
          }),
        ),
      )
      setIssuers(rows)
    } catch (err) {
      setMessageType('error')
      setMessage(toWalletError(err).message)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (isOwner) void loadIssuers()
  }, [isOwner, loadIssuers])

  function signerContract() {
    if (!session) throw new Error('Wallet non connecté.')
    return getContract(session.signer, session.chainId)
  }

  function fail(text: string) {
    setMessageType('error')
    setMessage(text)
  }

  /** Envoie une transaction, suit son état et recharge la liste des émetteurs. */
  async function run(
    pending: string,
    done: string,
    send: () => Promise<ContractTransactionResponse>,
  ): Promise<boolean> {
    setBusy(true)
    setMessageType('ok')
    setMessage(pending)
    setTxHash('')
    try {
      const tx = await send()
      setTxHash(tx.hash)
      setMessage('Transaction envoyée, en attente de confirmation…')
      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('La transaction a échoué.')
      setMessage(done)
      await loadIssuers()
      return true
    } catch (err) {
      fail(toWalletError(err).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!validAddress(newIssuer)) return fail('Adresse de l’émetteur invalide.')
    const address = newIssuer.trim()
    const ok = await run(
      'Confirmez la transaction dans MetaMask…',
      `Émetteur ${short(address)} ajouté.`,
      () => signerContract().addIssuer(address),
    )
    if (ok) setNewIssuer('')
  }

  async function onRemove(address: string) {
    if (!window.confirm(`Retirer l’autorisation de ${address} ?\nSes diplômes déjà émis restent valides.`)) return
    await run(
      'Confirmez la transaction dans MetaMask…',
      `Émetteur ${short(address)} retiré.`,
      () => signerContract().removeIssuer(address),
    )
  }

  async function onRotate(e: React.FormEvent) {
    e.preventDefault()
    if (!validAddress(oldIssuer)) return fail('Choisissez l’émetteur à remplacer.')
    if (!validAddress(replacement)) return fail('Adresse du remplaçant invalide.')
    const next = replacement.trim()
    const ok = await run(
      'Confirmez la transaction dans MetaMask…',
      `${short(oldIssuer)} remplacé par ${short(next)}. Pensez à révoquer ses diplômes si sa clé est compromise.`,
      () => signerContract().rotateIssuer(oldIssuer, next),
    )
    if (ok) {
      setOldIssuer('')
      setReplacement('')
    }
  }

  async function onSingleRevoke(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d+$/.test(diplomaId.trim())) return fail('Numéro de diplôme invalide.')
    const id = diplomaId.trim()
    const ok = await run(
      'Confirmez la transaction dans MetaMask…',
      `Diplôme n° ${id} révoqué.`,
      () => signerContract().revokeDiploma(id, singleReason),
    )
    if (ok) setDiplomaId('')
  }

  async function onBulkRevoke(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    if (!validAddress(bulkIssuer)) return fail('Choisissez l’émetteur compromis.')

    setBusy(true)
    setMessageType('ok')
    setTxHash('')
    try {
      setMessage('Recherche des diplômes valides de cet émetteur…')
      const reader = getContract(session.provider, session.chainId)
      const maxBatch = Number(await reader.MAX_BATCH_SIZE())
      const events = await reader.queryFilter(
        reader.filters.Issued(null, null, bulkIssuer),
        getDeploymentBlock(session.chainId),
      )

      const ids: bigint[] = []
      for (const ev of events) {
        const id = (ev as EventLog).args.diplomaId as bigint
        const d = await reader.diplomas(id)
        if (Number(d.status) === STATUS.Valid) ids.push(id)
      }

      if (ids.length === 0) {
        setMessage('Aucun diplôme valide à révoquer pour cet émetteur.')
        return
      }

      const chunks: bigint[][] = []
      for (let i = 0; i < ids.length; i += maxBatch) chunks.push(ids.slice(i, i + maxBatch))

      const reasonLabel = REVOCATION_REASONS.find((r) => r.value === bulkReason)?.label
      const confirmed = window.confirm(
        `Révoquer ${ids.length} diplôme(s) émis par ${bulkIssuer} ?\n` +
          `Motif : ${reasonLabel}.\n` +
          `${chunks.length} transaction(s) à signer. Cette action est définitive.`,
      )
      if (!confirmed) {
        setMessage('')
        return
      }

      const writer = signerContract()
      let done = 0
      for (let i = 0; i < chunks.length; i++) {
        setMessage(`Transaction ${i + 1}/${chunks.length} : confirmez dans MetaMask…`)
        const tx = await writer.revokeIssuerDiplomas(bulkIssuer, chunks[i], bulkReason)
        setTxHash(tx.hash)
        const receipt = await tx.wait()
        if (!receipt || receipt.status !== 1) throw new Error('Une transaction a échoué.')
        done += chunks[i].length
      }
      setMessage(`${done} diplôme(s) révoqué(s) pour ${short(bulkIssuer)}.`)
    } catch (err) {
      fail(toWalletError(err).message)
    } finally {
      setBusy(false)
    }
  }

  // --- Contrôle d'accès : réservé à l'owner ---
  if (!session) {
    return (
      <section>
        <h1>Administration</h1>
        <p>Connectez votre wallet pour accéder à l’administration.</p>
      </section>
    )
  }
  if (!roles) {
    return (
      <section>
        <h1>Administration</h1>
        <p>Rôles indisponibles : vérifiez le réseau et le déploiement du contrat.</p>
      </section>
    )
  }
  if (!isOwner) {
    return (
      <section>
        <h1>Administration</h1>
        <p className="alert">Cette page est réservée à l’administrateur (owner) du contrat.</p>
      </section>
    )
  }

  const explorer = txHash ? txUrl(session.chainId, txHash) : undefined
  const active = issuers.filter((i) => i.active)

  return (
    <section>
      <h1>Administration</h1>

      {message && (
        <p className={`status status-${messageType === 'ok' ? 'pending' : 'error'}`} role="status">
          {message}
        </p>
      )}
      {txHash && (
        <p className="hint">
          Transaction :{' '}
          {explorer ? (
            <a href={explorer} target="_blank" rel="noreferrer">{txHash}</a>
          ) : (
            <code>{txHash}</code>
          )}
        </p>
      )}

      <div className="panel">
        <div className="issued-head">
          <h2>Émetteurs autorisés</h2>
          <button onClick={() => void loadIssuers()} disabled={loading || busy}>
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
        </div>
        {issuers.length === 0 && !loading && <p className="hint">Aucun émetteur enregistré.</p>}
        <ul className="list">
          {issuers.map((i) => (
            <li key={i.address}>
              <span>
                <code title={i.address}>{i.address}</code>{' '}
                <span className={`badge ${i.active ? 'badge-valid' : 'badge-revoked'}`}>
                  {i.active ? 'Autorisé' : 'Retiré'}
                </span>
              </span>
              {i.active && (
                <button className="danger" onClick={() => void onRemove(i.address)} disabled={busy}>
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Ajouter un émetteur</h2>
        <form className="inline-form" onSubmit={onAdd}>
          <input
            value={newIssuer}
            onChange={(e) => setNewIssuer(e.target.value)}
            placeholder="0x… (adresse de l’institution)"
            disabled={busy}
          />
          <button type="submit" disabled={busy}>Ajouter</button>
        </form>
      </div>

      <div className="panel">
        <h2>Remplacer un émetteur (rotation de clé)</h2>
        <p className="hint">
          Retire l’ancien émetteur et autorise le nouveau en une seule transaction. Les diplômes
          déjà émis ne sont pas révoqués automatiquement.
        </p>
        <form className="inline-form" onSubmit={onRotate}>
          <select value={oldIssuer} onChange={(e) => setOldIssuer(e.target.value)} disabled={busy}>
            <option value="">Émetteur à remplacer…</option>
            {active.map((i) => (
              <option key={i.address} value={i.address}>{short(i.address)}</option>
            ))}
          </select>
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="0x… (nouvelle adresse)"
            disabled={busy}
          />
          <button type="submit" disabled={busy}>Remplacer</button>
        </form>
      </div>

      <div className="panel">
        <h2>Révoquer les diplômes d’un émetteur compromis</h2>
        <p className="hint">
          Révoque tous les diplômes encore valides de l’émetteur choisi, par lots de 50 maximum
          (une transaction par lot). Un émetteur déjà retiré peut aussi être sélectionné.
        </p>
        <form className="inline-form" onSubmit={onBulkRevoke}>
          <select value={bulkIssuer} onChange={(e) => setBulkIssuer(e.target.value)} disabled={busy}>
            <option value="">Émetteur compromis…</option>
            {issuers.map((i) => (
              <option key={i.address} value={i.address}>
                {short(i.address)}{i.active ? '' : ' (retiré)'}
              </option>
            ))}
          </select>
          <select
            value={bulkReason}
            onChange={(e) => setBulkReason(Number(e.target.value))}
            disabled={busy}
          >
            {REVOCATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button type="submit" className="danger" disabled={busy}>Révoquer en masse</button>
        </form>
      </div>

      <div className="panel">
        <h2>Révoquer un diplôme par numéro</h2>
        <form className="inline-form" onSubmit={onSingleRevoke}>
          <input
            value={diplomaId}
            onChange={(e) => setDiplomaId(e.target.value)}
            placeholder="N° du diplôme"
            inputMode="numeric"
            disabled={busy}
          />
          <select
            value={singleReason}
            onChange={(e) => setSingleReason(Number(e.target.value))}
            disabled={busy}
          >
            {REVOCATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button type="submit" className="danger" disabled={busy}>Révoquer</button>
        </form>
      </div>
    </section>
  )
}