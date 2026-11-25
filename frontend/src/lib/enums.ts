// Valeurs alignées sur shared/INTERFACE.md (enums de DiplomaRegistry.sol).
export const REVOCATION_REASONS = [
  { value: 0, label: 'Erreur de saisie' }, // DataEntryError
  { value: 1, label: 'Fraude' },           // Fraud
  { value: 2, label: 'Plagiat' },          // Plagiarism
] as const

export const STATUS = { None: 0, Valid: 1, Revoked: 2 } as const

export const STATUS_LABELS: Record<number, string> = {
  0: 'Inexistant',
  1: 'Valide',
  2: 'Révoqué',
}