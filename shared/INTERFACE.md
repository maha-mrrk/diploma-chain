
# DiplomaRegistry - Smart Contract Interface

## 1. Overview

The DiplomaRegistry contract manages diploma issuance,
revocation, verification and authorized institutions.

## 2. Enums

### Status
- None
- Valid
- Revoked

### RevocationReason
- DataEntryError
- Fraud
- Plagiarism

## 3. Main Functions

### F1 - Issue Diploma

```solidity
issueDiploma(
    address student,
    bytes32 diplomaHash,
    string calldata metadataURI
) returns (uint256 diplomaId)
```

Only authorized issuers can issue diplomas.

### F2 - Revoke Diploma

```solidity
revokeDiploma(
    uint256 diplomaId,
    RevocationReason reason
)
```

Only the original issuer or the contract owner
can revoke a diploma.

Implementation note:
The revocation reason is provided as an enum and emitted
as an enum in the Revoked event. It is also converted
to a readable string and stored in the Diploma struct.

### F3 - Verify Diploma

```solidity
verify(
    uint256 diplomaId,
    bytes32 diplomaHash
) view returns (
    bool isValid,
    address issuer,
    uint64 issuedAt,
    Status status
)
```
The diploma is considered valid only if:
- The diploma exists and its status is Valid.
- The provided hash matches the stored diploma hash.

A revoked diploma or an incorrect hash returns isValid = false.

### F4 - Issuer Management

```solidity
addIssuer(address issuer)
removeIssuer(address issuer)
```

Only the contract owner can manage issuers.

## 4. Events

```solidity
event Issued(
    uint256 indexed diplomaId,
    address indexed student,
    address indexed issuer,
    bytes32 diplomaHash
);

event Revoked(
    uint256 indexed diplomaId,
    address indexed issuer,
    RevocationReason reason
);

event IssuerAdded(address indexed issuer);
event IssuerRemoved(address indexed issuer);
```

## 5. Security Rules

- No personal information stored on-chain.
- Diploma hashes use SHA-256.
- Duplicate hashes are rejected.
- Only authorized issuers can issue diplomas.
- Only the original issuer or owner can revoke a diploma.
- Revocation reasons are mandatory.
- Administrative functions are restricted to the owner.
- SHA-256 hashing is performed off-chain.
- The resulting 32-byte hash is passed to the smart contract.
- A previously registered hash cannot be reused, even after revocation.
- No directly identifiable personal information is stored on-chain.
- Only pseudonymous wallet addresses and necessary diploma data are stored on-chain.

## 6. Off-chain Data

PDF documents and diploma metadata are stored off-chain.

The contract only stores the diploma hash,
the metadata URI and necessary identifiers.
