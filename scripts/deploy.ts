import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

const [deployer] = await ethers.getSigners();
console.log(`Réseau       : ${networkName}`);
console.log(`Déployeur    : ${deployer.address}`);

const registry = await ethers.deployContract("DiplomaRegistry");
await registry.waitForDeployment();

const address = await registry.getAddress();
const txHash = registry.deploymentTransaction()?.hash;
const chainId = (await ethers.provider.getNetwork()).chainId;

console.log(`DiplomaRegistry déployé à : ${address}`);

// Optionnel : autoriser un premier émetteur (ex. l'institution)
const issuer = process.env.ISSUER_ADDRESS;
if (issuer) {
  const tx = await registry.addIssuer(issuer);
  await tx.wait();
  console.log(`Émetteur autorisé : ${issuer}`);
}

// On ne sauvegarde que les vrais réseaux (localhost, sepolia),
// pas les réseaux simulés en mémoire qui disparaissent après le script.
const isSimulated = networkName === "default" || networkName.startsWith("hardhat");

if (!isSimulated) {
  const dir = path.resolve("shared", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${networkName}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        network: networkName,
        chainId: chainId.toString(),
        address,
        deployer: deployer.address,
        txHash,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`Adresse sauvegardée dans ${file}`);
} else {
  console.log("Réseau simulé : aucune adresse sauvegardée.");
}