# DiplomaRegistry – Security Analysis

## 1. Scope

This document presents a security review of the `DiplomaRegistry` smart contract.

The review focuses on access control, diploma integrity, revocation rules, data privacy and potential misuse of contract functions.

This is an internal code review, not a formal security audit.

## 2. Access Control

### Issuance

- Only addresses registered in `authorizedIssuers` can issue diplomas.
- Unauthorized calls revert with `UnauthorizedIssuer`.
- The student address cannot be the zero address.
- The diploma hash cannot be zero.
- Empty metadata URIs are rejected.

**Assessment:** The issuance function enforces the required authorization and input validation rules.

### Revocation

- A diploma can be revoked by its original issuer only while that issuer remains authorized.
- The contract owner can always revoke any diploma.
- Removed or compromised issuers cannot revoke diplomas they previously issued.
- A diploma cannot be revoked if it does not exist.
- A diploma cannot be revoked more than once.
- The revocation reason is recorded.

**Assessment:** Revocation permissions are restricted to authorized original issuers and the contract owner. Removing an issuer also removes its individual revocation privileges.

### Issuer Management

- Only the contract owner can add or remove issuers.
- The zero address cannot be authorized.
- Already authorized issuers cannot be added again.
- Non-authorized issuers cannot be removed.
- The owner can rotate a compromised issuer by removing the old address and authorizing a replacement.
- The owner can revoke multiple diplomas issued by a compromised issuer in a single transaction, with a maximum batch size of 50.

**Assessment:** Issuer management is protected by OpenZeppelin's `Ownable` access control. Rotation prevents the compromised address from issuing or individually revoking diplomas. Bulk revocation allows the owner to invalidate affected diplomas.

## 3. Diploma Integrity

- Each diploma is associated with a `bytes32` hash.
- The application must calculate the SHA-256 hash of the original PDF off-chain.
- The resulting hash is stored on-chain.
- Duplicate hashes are rejected through `hashExists`.
- A revoked diploma's hash remains registered and cannot be reused.

**Important limitation:** The contract accepts a `bytes32` value and does not itself calculate or enforce SHA-256. The frontend and backend must consistently use SHA-256.

## 4. Verification

The `verify()` function returns `isValid = true` only when:

- The diploma status is `Valid`.
- The submitted hash matches the stored hash.

A nonexistent diploma, revoked diploma or incorrect hash cannot be considered valid.

## 5. Privacy and Off-chain Storage

The contract does not store PDF documents directly.

However, blockchain data is public. The contract stores wallet addresses, diploma hashes and metadata URIs.

The metadata URI must not expose sensitive personal information. The backend must apply appropriate access controls and, where necessary, encryption.

## 6. Identified Risks and Recommendations

| Risk | Level | Recommendation |
|---|---|---|
| Owner private-key compromise | High | Use a multisig wallet for production administration |
| Public wallet addresses and metadata URI | Medium | Avoid storing directly identifiable personal information |
| Metadata availability or modification | Medium | Use reliable storage; consider IPFS and content integrity checks |
| SHA-256 not enforced by contract | Medium | Ensure consistent SHA-256 computation in frontend and backend |
| Permanent hash registration after revocation | Low / By design | Document that revoked diploma hashes cannot be reused |

## 7. Additional Security Observations

- The contract does not make external calls when issuing or revoking diplomas, limiting common reentrancy risks.
- State changes are protected by access-control checks.
- OpenZeppelin `Ownable` provides ownership management.
- Events are emitted for issuance, revocation and issuer-management operations, supporting traceability.

## 8. Conclusion

The current implementation enforces the main business rules for diploma issuance, verification, revocation and issuer management.

The main production considerations are owner-key security, protection of off-chain metadata, and consistent SHA-256 computation across the application.

Further testing and an independent professional audit are recommended before production deployment.


## 9. Static Analysis with Slither

### Tool and Configuration

- Tool: Slither
- Version: 0.11.6
- Solidity compiler used by Hardhat: 0.8.34
- Analysis scope: 3 contracts
- Detectors executed: 102

### Results

Slither reported 2 findings:

1. **Different pragma directives**

   The main contract uses Solidity pragma ^0.8.34,
   while OpenZeppelin dependencies use ^0.8.20.

   This is expected because OpenZeppelin supports a broader
   range of compatible compiler versions.

2. **Solidity version constraint**

   Slither reports that the ^0.8.20 constraint includes
   compiler versions affected by known issues.

   The project is compiled using Solidity 0.8.34.
   The warning concerns the dependency's declared version
   range, not the actual compiler version used.

### Conclusion

No critical or high-severity vulnerability was reported
by the executed Slither detectors.

The two findings are related to compiler version declarations
and do not independently establish an exploitable vulnerability.

Static analysis is not a substitute for a professional
smart contract security audit.
