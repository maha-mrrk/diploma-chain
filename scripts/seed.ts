import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

const file = path.resolve("shared", "deployments", `${networkName}.json`);
if (!fs.existsSync(file)) {
  throw new Error(`Déploie d'abord le contrat : ${file} est introuvable.`);
}
const { address } = JSON.parse(fs.readFileSync(file, "utf8"));
const registry: any = await ethers.getContractAt("DiplomaRegistry", address);

const [owner, institution, student1, student2] = await ethers.getSigners();
const h = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

if (!(await registry.authorizedIssuers(institution.address))) {
  await (await registry.connect(owner).addIssuer(institution.address)).wait();
}
console.log(`Institution autorisée : ${institution.address}`);

const demos = [
  { student: student1.address, label: "demo-diplome-1", uri: "http://localhost:3001/diploma/demo1" },
  { student: student2.address, label: "demo-diplome-2", uri: "http://localhost:3001/diploma/demo2" },
];

for (const d of demos) {
  const tx = await registry.connect(institution).issueDiploma(d.student, h(d.label), d.uri);
  await tx.wait();
  console.log(`Diplôme émis pour ${d.student} (hash de "${d.label}")`);
}