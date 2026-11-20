\# diploma-chain



Plateforme d'émission et de vérification de diplômes basée sur la blockchain

(projet du module Technologie Blockchain).



Principe : aucune donnée personnelle en clair on-chain. Le contrat ne stocke que

des hash SHA-256 et des identifiants ; les PDF et métadonnées sont off-chain.



\## Prérequis



\- Node.js 22 ou plus

\- MetaMask (pour la dApp)



\## Installation



&#x20;   git clone https://github.com/maha-mrrk/diploma-chain.git

&#x20;   cd diploma-chain

&#x20;   npm install



\## Secrets (Sepolia)



Les secrets sont enregistrés avec le keystore Hardhat, jamais dans le dépôt :



&#x20;   npx hardhat keystore set SEPOLIA\_RPC\_URL

&#x20;   npx hardhat keystore set SEPOLIA\_PRIVATE\_KEY



Ne jamais committer de clé privée ni de fichier `.env`. Utiliser un portefeuille

de test dédié.



\## Tests, couverture, gas



&#x20;   npx hardhat build

&#x20;   npx hardhat test

&#x20;   npx hardhat test --coverage

&#x20;   npx hardhat test --gas-stats



\## Démo locale reproductible



Terminal 1 : nœud local



&#x20;   npx hardhat node



Terminal 2 : déploiement et données de démo



&#x20;   npx hardhat run scripts/deploy.ts --network localhost

&#x20;   npx hardhat run scripts/seed.ts --network localhost



L'adresse du contrat est écrite dans `shared/deployments/localhost.json`.

Le seed autorise le compte n°1 de Hardhat comme institution et émet deux

diplômes de démonstration. Pour émettre depuis la dApp, importer dans MetaMask

la clé de ce compte de test (affichée au lancement du nœud) et ajouter le

réseau local (RPC http://127.0.0.1:8545, chainId 31337).



Terminal 3 : serveur off-chain



&#x20;   cd server

&#x20;   npm install

&#x20;   npm start



API (port 3001) :



\- `POST /upload` : multipart, champ `pdf` + `studentName`, `title`, `year`,

&#x20; `mention`. Renvoie `id`, `diplomaHash` et `metadataURI`.

\- `GET /diploma/:id` : métadonnées (l'id est le SHA-256 du PDF).

\- `GET /diploma/:id/pdf` : le PDF stocké.



Le `diplomaHash` et le `metadataURI` renvoyés sont à passer à

`issueDiploma(student, diplomaHash, metadataURI)`.



\## Déploiement Sepolia



&#x20;   npx hardhat run scripts/deploy.ts --network sepolia



L'adresse est écrite dans `shared/deployments/sepolia.json`.



\## dApp



Voir `frontend/` (instructions à compléter par l'équipe dApp).



\## Structure



&#x20;   contracts/   smart contract (Membre 1)

&#x20;   test/        tests Hardhat (Membre 2)

&#x20;   scripts/     déploiement et seed (Membre 2)

&#x20;   server/      stockage off-chain (Membre 2)

&#x20;   frontend/    dApp React (Membres 3 et 4)

&#x20;   shared/      ABI, interface, adresses déployées

&#x20;   docs/        sécurité, rapport



\## Workflow Git



Une branche par membre, aucune poussée directe sur `main`, pull request relue

par un autre membre, CI verte avant fusion. Commits au format Conventional

Commits (feat:, fix:, test:, docs:, chore:).

