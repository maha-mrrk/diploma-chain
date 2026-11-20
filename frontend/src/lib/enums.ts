// ⚠️ À vérifier dans shared/INTERFACE.md ou contracts/DiplomaRegistry.sol
// (enums RevocationReason et Status) : l'ordre doit être identique.
export const REVOCATION_REASONS = [
  { value: 0, label: 'Erreur de saisie' },
  { value: 1, label: 'Fraude' },
  { value: 2, label: 'Plagiat' },
] as const

export const STATUS_LABELS: Record<number, string> = {
  0: 'Valide',
  1: 'Révoqué',
}