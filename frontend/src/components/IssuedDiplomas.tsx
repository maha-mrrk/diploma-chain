import { useCallback, useEffect, useState } from 'react'
import type { EventLog } from 'ethers'
import { useWallet } from '../context/useWallet'
import { getContract, toWalletError, txUrl } from '../lib/contract'
import { getDeploymentBlock } from '../lib/config'
import { REVOCATION_REASONS, STATUS, STATUS_LABELS } from '../lib/enums'

interface Row {
  id: string
  student: string
  hash: string
  issuedAt: number
  status: number
  metadataURI: string
  reason: string
}

function short(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export default function IssuedDiplomas({ refreshKey = 0 }: { refreshKey?: number }) {
  const { session } = useWallet()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [target, setTarget] = useState<string | null>(null) // diplôme en cours de confirmation
  const [reason, setReason] = useState<number>(REVOCATION_REASONS[0].value)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'error'>('ok')
  const [txHash, setTxHash] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const contract = getContract(session.provider, session.chainId)
      const events = await contract.queryFilter(
        contract.filters.Issued(null, null, session.address),
        getDeploymentBlock(session.chainId),
      )
      const list = await Promise.all(
        events.map(async (ev): Promise<Row> => {
          const id = (ev as EventLog).args.diplomaId as bigint
          const d = await contract.diplomas(id)
          return {
            id: id.toString(),
            student: d.student as string,
            hash: d.hash as string,
            issuedAt: Number(d.issuedAt),
            status: Number(d.status),
            metadataURI: d.metadataURI as string,
            reason: d.revocationReason as string,
          }
        }),
      )
      list.sort((a, b) => Number(b.id) - Number(a.id))
      setRows(list)
    } catch (err) {
      setError(toWalletError(err).message)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  function openConfirm(id: string) {
    setTarget(id)
    setReason(REVOCATION_REASONS[0].value)
    setMessage('')
    setTxHash('')
  }

  async function onRevoke(id: string) {
    if (!session) return
    setBusy(true)
    setMessage('Confirmez la transaction dans MetaMask…')
    setMessageType('ok')
    setTxHash('')
    try {
      const contract = getContract(session.signer, session.chainId)
      const tx = await contract.revokeDiploma(id, reason)
      setTxHash(tx.hash)
      setMessage('Transaction envoyée, en attente de confirmation…')
      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('La transaction a échoué.')
      setMessage(`Diplôme n° ${id} révoqué.`)
      setTarget(null)
      await load()
    } catch (err) {
      setMessageType('error')
      setMessage(toWalletError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (!session) return null
  const explorer = txHash ? txUrl(session.chainId, txHash) : undefined

  return (
    <section className="issued">
      <div className="issued-head">
        <h2>Diplômes émis par mon compte</h2>
        <button onClick={() => void load()} disabled={loading || busy}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {error && <p className="status status-error">{error}</p>}
      {message && (
        <p className={`status status-${messageType === 'ok' ? 'pending' : 'error'}`} role="status">
          {message}
        </p>
      )}
      {txHash && (
        <p className="hint">
          Transaction : {explorer ? <a href={explorer} target="_blank" rel="noreferrer">{txHash}</a> : <code>{txHash}</code>}
        </p>
      )}

      {!loading && !error && rows.length === 0 && <p className="hint">Aucun diplôme émis pour le moment.</p>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Étudiant</th>
                <th>Date</th>
                <th>Hash</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td title={r.student}>{short(r.student)}</td>
                  <td>{new Date(r.issuedAt * 1000).toLocaleDateString('fr-FR')}</td>
                  <td title={r.hash}>
                    <a href={r.metadataURI} target="_blank" rel="noreferrer">{short(r.hash)}</a>
                  </td>
                  <td>
                    <span className={`badge ${r.status === STATUS.Valid ? 'badge-valid' : 'badge-revoked'}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.status === STATUS.Revoked && r.reason && (
                      <span className="hint"> ({r.reason})</span>
                    )}
                  </td>
                  <td>
                    {r.status !== STATUS.Valid ? (
                      '—'
                    ) : target === r.id ? (
                      <div className="confirm">
                        <select
                          value={reason}
                          onChange={(e) => setReason(Number(e.target.value))}
                          disabled={busy}
                        >
                          {REVOCATION_REASONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button className="danger" onClick={() => void onRevoke(r.id)} disabled={busy}>
                          Confirmer la révocation
                        </button>
                        <button className="secondary" onClick={() => setTarget(null)} disabled={busy}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button className="danger" onClick={() => openConfirm(r.id)} disabled={busy}>
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="hint">
        La révocation est définitive et publique : le hash d'un diplôme révoqué ne pourra jamais
        être réutilisé.
      </p>
    </section>
  )
}