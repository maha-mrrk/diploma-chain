
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DiplomaRegistry is Ownable {

    // Possible states of a diploma
    enum Status {
        None,
        Valid,
        Revoked
    }

    // Mandatory reasons for revocation
    enum RevocationReason {
        DataEntryError,
        Fraud,
        Plagiarism
    }

    // Diploma information stored on-chain
    struct Diploma {
        bytes32 hash;
        address issuer;
        address student;
        uint64 issuedAt;
        Status status;
        string metadataURI;
        string revocationReason;
    }

    // Storage
    mapping(uint256 => Diploma) public diplomas;
    mapping(bytes32 => bool) public hashExists;
    mapping(address => bool) public authorizedIssuers;

    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 private nextDiplomaId = 1;

    // Custom errors
    error SameIssuerAddress();
    error InvalidBatchSize();
    error DiplomaNotIssuedByIssuer();
    error UnauthorizedIssuer();
    error InvalidStudentAddress();
    error InvalidDiplomaHash();
    error DuplicateDiplomaHash();
    error DiplomaNotFound();
    error DiplomaAlreadyRevoked();
    error UnauthorizedRevocation();
    error InvalidMetadataURI();
    error InvalidIssuerAddress();
    error IssuerAlreadyAuthorized();
    error IssuerNotAuthorized();

    // Events

    event IssuerRotated(
    address indexed oldIssuer,
    address indexed newIssuer
);


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

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Issue a new diploma.
     * @dev Only authorized issuers can issue diplomas.
     */
    function issueDiploma(
        address student,
        bytes32 diplomaHash,
        string calldata metadataURI
    ) external returns (uint256 diplomaId) {

        if (!authorizedIssuers[msg.sender]) {
            revert UnauthorizedIssuer();
        }

        if (student == address(0)) {
            revert InvalidStudentAddress();
        }

        if (diplomaHash == bytes32(0)) {
            revert InvalidDiplomaHash();
        }

        if (hashExists[diplomaHash]) {
            revert DuplicateDiplomaHash();
        }

        if (bytes(metadataURI).length == 0) {
            revert InvalidMetadataURI();
        }

        diplomaId = nextDiplomaId++;

        diplomas[diplomaId] = Diploma({
            hash: diplomaHash,
            issuer: msg.sender,
            student: student,
            issuedAt: uint64(block.timestamp),
            status: Status.Valid,
            metadataURI: metadataURI,
            revocationReason: ""
        });

        hashExists[diplomaHash] = true;

        emit Issued(
            diplomaId,
            student,
            msg.sender,
            diplomaHash
        );
    }

    /**
     * @notice Revoke an existing diploma.
     * @dev Only the original issuer or the owner can revoke it.
     */
    function revokeDiploma(
        uint256 diplomaId,
        RevocationReason reason
    ) external {

        Diploma storage diploma = diplomas[diplomaId];

        if (diploma.status == Status.None) {
            revert DiplomaNotFound();
        }

        if (diploma.status == Status.Revoked) {
            revert DiplomaAlreadyRevoked();
        }

        if (
            msg.sender != owner() &&
            (msg.sender != diploma.issuer || !authorizedIssuers[msg.sender])
        ) {
            revert UnauthorizedRevocation();
        }

        diploma.status = Status.Revoked;
        diploma.revocationReason = _reasonToString(reason);

        emit Revoked(
            diplomaId,
            diploma.issuer,
            reason
        );
    }

    /**
     * @notice Verify a diploma using its ID and document hash.
     * @dev Anyone can call this function.
     */
    function verify(
        uint256 diplomaId,
        bytes32 diplomaHash
    )
        external
        view
        returns (
            bool isValid,
            address issuer,
            uint64 issuedAt,
            Status status
        )
    {
        Diploma storage diploma = diplomas[diplomaId];

        status = diploma.status;
        issuer = diploma.issuer;
        issuedAt = diploma.issuedAt;

        isValid =
            status == Status.Valid &&
            diploma.hash == diplomaHash;
    }

    /**
     * @notice Authorize a new diploma issuer.
     * @dev Only the contract owner can call this function.
     */
    function addIssuer(address issuer) external onlyOwner {

        if (issuer == address(0)) {
            revert InvalidIssuerAddress();
        }

        if (authorizedIssuers[issuer]) {
            revert IssuerAlreadyAuthorized();
        }

        authorizedIssuers[issuer] = true;

        emit IssuerAdded(issuer);
    }

    /**
     * @notice Remove an authorized diploma issuer.
     * @dev Only the contract owner can call this function.
     */
    function removeIssuer(address issuer) external onlyOwner {

        if (!authorizedIssuers[issuer]) {
            revert IssuerNotAuthorized();
        }

        authorizedIssuers[issuer] = false;

        emit IssuerRemoved(issuer);
    }
    /**
 * @notice Replace a compromised issuer with a new authorized issuer.
 * @dev Only the contract owner can rotate an issuer.
 */
function rotateIssuer(
    address oldIssuer,
    address newIssuer
) external onlyOwner {

    if (!authorizedIssuers[oldIssuer]) {
        revert IssuerNotAuthorized();
    }

    if (newIssuer == address(0)) {
        revert InvalidIssuerAddress();
    }

    if (oldIssuer == newIssuer) {
        revert SameIssuerAddress();
    }

    if (authorizedIssuers[newIssuer]) {
        revert IssuerAlreadyAuthorized();
    }

    authorizedIssuers[oldIssuer] = false;
    authorizedIssuers[newIssuer] = true;

    emit IssuerRemoved(oldIssuer);
    emit IssuerAdded(newIssuer);
    emit IssuerRotated(oldIssuer, newIssuer);
}

/**
 * @notice Revoke multiple diplomas issued by a compromised issuer.
 * @dev Only the owner can call this function.
 *      The operation is limited to MAX_BATCH_SIZE diplomas per transaction.
 */
function revokeIssuerDiplomas(
    address compromisedIssuer,
    uint256[] calldata diplomaIds,
    RevocationReason reason
) external onlyOwner {

    uint256 batchSize = diplomaIds.length;

    if (
        batchSize == 0 ||
        batchSize > MAX_BATCH_SIZE
    ) {
        revert InvalidBatchSize();
    }

    for (uint256 i = 0; i < batchSize; i++) {

        uint256 diplomaId = diplomaIds[i];
        Diploma storage diploma = diplomas[diplomaId];

        if (diploma.status == Status.None) {
            revert DiplomaNotFound();
        }

        if (diploma.issuer != compromisedIssuer) {
            revert DiplomaNotIssuedByIssuer();
        }

        if (diploma.status == Status.Revoked) {
            revert DiplomaAlreadyRevoked();
        }

        diploma.status = Status.Revoked;
        diploma.revocationReason = _reasonToString(reason);

        emit Revoked(
            diplomaId,
            compromisedIssuer,
            reason
        );
    }
}
    /**
     * @dev Convert the revocation enum to a readable string.
     */
    function _reasonToString(
        RevocationReason reason
    ) internal pure returns (string memory) {

        if (reason == RevocationReason.DataEntryError) {
            return "DataEntryError";
        }

        if (reason == RevocationReason.Fraud) {
            return "Fraud";
        }

        return "Plagiarism";
    }
}
