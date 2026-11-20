import { network } from "hardhat";

const { ethers } = await network.connect();
const [signer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(signer.address);

console.log(`Adresse : ${signer.address}`);
console.log(`Solde   : ${ethers.formatEther(balance)} ETH`);
