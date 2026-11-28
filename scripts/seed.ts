import { network } from "hardhat";
import fs from "node:fs";

const { ethers, networkName } = await network.connect();
const signers = await ethers.getSigners();
const [deployer] = signers;

const dep = JSON.parse(fs.readFileSync(`shared/deployments/${networkName}.json`, "utf8"));
const registry = await ethers.getContractAt("DiplomaRegistry", dep.address);

const tx0 = await registry.addIssuer(deployer.address);
await tx0.wait();
console.log(`Institution autorisée : ${deployer.address}`);

const student = signers[1]?.address ?? ethers.Wallet.createRandom().address;

for (let i = 1; i <= 2; i++) {
  const hash = ethers.sha256(ethers.toUtf8Bytes(`demo-diploma-${i}-${Date.now()}`));
  const uri = `http://localhost:3001/diploma/${hash.slice(2)}`;
  const tx = await registry.issueDiploma(student, hash, uri);
  await tx.wait();
  console.log(`Diplôme ${i} émis : ${hash}`);
}
