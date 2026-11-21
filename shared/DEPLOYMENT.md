# DiplomaRegistry – Deployment Information

## 1. Local Development Network

| Parameter | Value |
|---|---|
| Network | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Contract | DiplomaRegistry |
| Contract Address | 0x5FbDB2315678afecb367f032d93F642f64180aa3 |

## 2. Contract ABI

The ABI is available at:

`abi/DiplomaRegistry.json`

Use this ABI with ethers.js to interact with the deployed contract.

## 3. Test Accounts

| Account | Address | Role |
|---|---|---|
| Account #0 | 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 | Owner / Administrator |
| Account #1 | 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 | Issuer candidate |
| Account #2 | 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc | Student |
| Account #3 | 0x90f79bf6eb2c4f870365e785982e1f101e93b906 | Unauthorized user |

**Important:** Account #1 must first be authorized by the owner using `addIssuer()`.

## 4. Important Notes

- This deployment is for local development only.
- The Hardhat node must remain running at `http://127.0.0.1:8545`.
- Local blockchain state is temporary and is lost when the node is restarted.
- Never use Hardhat test accounts or their private keys on a real network.
- A separate Sepolia deployment will be documented later.