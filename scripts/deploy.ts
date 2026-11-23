import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName } = await network.connect();
const [deployer] = await ethers.getSigners();

console.log(`Réseau   : ${networkName}`);
console.log(`Déployeur: ${deployer.address}`);

// Si le constructeur de M1 n'a pas d'argument, remplace [] par []
const registry = await ethers.deployContract("DiplomaRegistry", []);
await registry.waitForDeployment();

const address = await registry.getAddress();
const receipt = await registry.deploymentTransaction()?.wait();
const { chainId } = await ethers.provider.getNetwork();

const out = {
  network: networkName,
  chainId: Number(chainId),
  address,
  deployer: deployer.address,
  blockNumber: receipt?.blockNumber ?? null,
  deployedAt: new Date().toISOString(),
};

const dir = path.join("shared", "deployments");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${networkName}.json`), JSON.stringify(out, null, 2));

console.log(`DiplomaRegistry déployé : ${address}`);
console.log(`Écrit dans shared/deployments/${networkName}.json`);
