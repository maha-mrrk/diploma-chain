# DiplomaRegistry - Smart Contract Interface

## 1. Overview

The DiplomaRegistry smart contract manages diploma issuance, revocation, verification, and authorized issuer management.

The contract uses OpenZeppelin Ownable for administrative access control.

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

    issueDiploma(address student, bytes32 diplomaHash, string calldata metadataURI)
    external returns (uint256 diplomaId)

Only authorized issuers can issue diplomas.

Requirements:
- Student address must not be zero.
- Diploma hash must not be zero.
- Diploma hash must not already exist.
- Metadata URI must not be empty.

### F2 - Revoke Diploma

    revokeDiploma(uint256 diplomaId, RevocationReason reason) external

Only the original issuer or the contract owner can revoke a diploma.

The revocation reason is stored as a readable string and emitted as an enum in the Revoked event.

### F3 - Verify Diploma

    verify(uint256 diplomaId, bytes32 diplomaHash) external view returns (
        bool isValid, address issuer, uint64 issuedAt, Status status
    )

A diploma is valid only if:
- Its status is Valid.
- The provided hash matches the stored hash.

A revoked diploma, nonexistent diploma, or incorrect hash returns isValid = false.

### F4 - Issuer Management

    addIssuer(address issuer) external
    removeIssuer(address issuer) external

Only the contract owner can add or remove authorized issuers.

Zero addresses and already-authorized issuers are rejected. Removing an unauthorized issuer is also rejected.

### F5 - Compromised Issuer Rotation

    rotateIssuer(address oldIssuer, address newIssuer) external

Only the contract owner can rotate an issuer.

This operation:
- Removes authorization from the compromised issuer.
- Authorizes the replacement issuer.
- Emits IssuerRemoved, IssuerAdded, and IssuerRotated events.

The replacement address must not be zero, identical to the old issuer, or already authorized.

Rotation does not automatically revoke previously issued diplomas. Use revokeIssuerDiplomas for that operation.

### F6 - Bulk Diploma Revocation

    revokeIssuerDiplomas(address compromisedIssuer, uint256[] calldata diplomaIds, RevocationReason reason) external

Only the contract owner can call this function.

It revokes multiple diplomas issued by the specified issuer.

Requirements:
- The batch must contain at least one diploma.
- Maximum batch size: 50 diplomas.
- Every diploma must exist.
- Every diploma must belong to the specified issuer.
- No diploma can already be revoked.

Each successful revocation emits a Revoked event.

Large sets of diplomas must be processed in multiple transactions.

## 4. Public State Variables

    mapping(uint256 => Diploma) public diplomas;
    mapping(bytes32 => bool) public hashExists;
    mapping(address => bool) public authorizedIssuers;
    uint256 public constant MAX_BATCH_SIZE = 50;

The public getters allow external applications to retrieve diploma information, hash registration status, issuer authorization, and the maximum batch size.

## 5. Events

    event Issued(uint256 indexed diplomaId, address indexed student, address indexed issuer, bytes32 diplomaHash);
    event Revoked(uint256 indexed diplomaId, address indexed issuer, RevocationReason reason);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event IssuerRotated(address indexed oldIssuer, address indexed newIssuer);

## 6. Security Rules

- Only authorized issuers can issue diplomas.
- Only the original issuer or owner can revoke an individual diploma.
- Only the owner can manage issuers and perform bulk revocations.
- Zero addresses and invalid diploma data are rejected.
- Duplicate diploma hashes are rejected.
- A registered hash cannot be reused, even after revocation.
- Revocation reasons are mandatory.
- Bulk revocation is limited to 50 diplomas per transaction.
- SHA-256 hashing is performed off-chain.
- The resulting 32-byte hash is passed to the smart contract.
- No PDF document is stored directly on-chain.
- Wallet addresses, diploma hashes, metadata URIs, and diploma records are publicly accessible on-chain.
- Metadata must not expose sensitive personal information.

## 7. Off-chain Data

PDF documents and additional diploma metadata are stored off-chain.

The contract stores the diploma hash, issuer and student addresses, issuance timestamp, status, metadata URI, and revocation reason.

The backend is responsible for document storage and metadata access.
