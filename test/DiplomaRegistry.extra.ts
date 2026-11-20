import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

// Enums du contrat
const Status = { None: 0n, Valid: 1n, Revoked: 2n };
const Reason = { DataEntryError: 0, Fraud: 1, Plagiarism: 2 };

const h = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const URI = "ipfs://bafy-test-metadata";

describe("DiplomaRegistry - tests complémentaires", function () {
  let registry: any;
  let owner: any, issuer: any, issuer2: any, student: any, outsider: any;

  beforeEach(async function () {
    [owner, issuer, issuer2, student, outsider] = await ethers.getSigners();
    registry = await ethers.deployContract("DiplomaRegistry");
    await registry.addIssuer(issuer.address);
  });

  async function issue(signer: any, label: string) {
    await registry.connect(signer).issueDiploma(student.address, h(label), URI);
  }

  describe("Déploiement", function () {
    it("définit le déployeur comme owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("démarre sans émetteur autorisé ni diplôme", async function () {
      expect(await registry.authorizedIssuers(outsider.address)).to.equal(false);
      expect((await registry.diplomas(1)).status).to.equal(Status.None);
    });

    it("expose MAX_BATCH_SIZE = 50", async function () {
      expect(await registry.MAX_BATCH_SIZE()).to.equal(50n);
    });
  });

  describe("Émission", function () {
    it("émet l'événement Issued avec les bons arguments", async function () {
      await expect(
        registry.connect(issuer).issueDiploma(student.address, h("d1"), URI)
      )
        .to.emit(registry, "Issued")
        .withArgs(1n, student.address, issuer.address, h("d1"));
    });

    it("stocke correctement tous les champs du diplôme", async function () {
      await issue(issuer, "d1");
      const d = await registry.diplomas(1);
      const block = await ethers.provider.getBlock("latest");

      expect(d.hash).to.equal(h("d1"));
      expect(d.issuer).to.equal(issuer.address);
      expect(d.student).to.equal(student.address);
      expect(d.status).to.equal(Status.Valid);
      expect(d.metadataURI).to.equal(URI);
      expect(d.revocationReason).to.equal("");
      expect(d.issuedAt).to.equal(BigInt(block!.timestamp));
      expect(await registry.hashExists(h("d1"))).to.equal(true);
    });

    it("incrémente les identifiants à partir de 1", async function () {
      await issue(issuer, "d1");
      await issue(issuer, "d2");
      expect((await registry.diplomas(1)).hash).to.equal(h("d1"));
      expect((await registry.diplomas(2)).hash).to.equal(h("d2"));
      expect((await registry.diplomas(3)).status).to.equal(Status.None);
    });

    it("refuse l'émission par le owner s'il n'est pas émetteur", async function () {
      await expect(
        registry.connect(owner).issueDiploma(student.address, h("d1"), URI)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedIssuer");
    });

    it("autorise plusieurs émetteurs indépendants", async function () {
      await registry.addIssuer(issuer2.address);
      await issue(issuer, "d1");
      await issue(issuer2, "d2");
      expect((await registry.diplomas(1)).issuer).to.equal(issuer.address);
      expect((await registry.diplomas(2)).issuer).to.equal(issuer2.address);
    });

    it("refuse un hash déjà utilisé même par un autre émetteur", async function () {
      await registry.addIssuer(issuer2.address);
      await issue(issuer, "d1");
      await expect(
        registry.connect(issuer2).issueDiploma(student.address, h("d1"), URI)
      ).to.be.revertedWithCustomError(registry, "DuplicateDiplomaHash");
    });
  });

  describe("Vérification", function () {
    it("retourne les infos d'un diplôme valide", async function () {
      await issue(issuer, "d1");
      const r = await registry.verify(1, h("d1"));
      expect(r.isValid).to.equal(true);
      expect(r.issuer).to.equal(issuer.address);
      expect(r.status).to.equal(Status.Valid);
      expect(r.issuedAt).to.be.greaterThan(0n);
    });

    it("retourne invalide pour un identifiant inexistant", async function () {
      const r = await registry.verify(999, h("d1"));
      expect(r.isValid).to.equal(false);
      expect(r.status).to.equal(Status.None);
      expect(r.issuer).to.equal(ethers.ZeroAddress);
    });

    it("retourne invalide avec le hash d'un autre diplôme", async function () {
      await issue(issuer, "d1");
      await issue(issuer, "d2");
      expect((await registry.verify(1, h("d2"))).isValid).to.equal(false);
    });

    it("est appelable par n'importe qui", async function () {
      await issue(issuer, "d1");
      const r = await registry.connect(outsider).verify(1, h("d1"));
      expect(r.isValid).to.equal(true);
    });

    it("montre le statut Revoked après révocation", async function () {
      await issue(issuer, "d1");
      await registry.connect(issuer).revokeDiploma(1, Reason.Fraud);
      const r = await registry.verify(1, h("d1"));
      expect(r.isValid).to.equal(false);
      expect(r.status).to.equal(Status.Revoked);
    });
  });

  describe("Révocation", function () {
    beforeEach(async function () {
      await issue(issuer, "d1");
    });

    it("émet l'événement Revoked avec les bons arguments", async function () {
      await expect(registry.connect(issuer).revokeDiploma(1, Reason.Fraud))
        .to.emit(registry, "Revoked")
        .withArgs(1n, issuer.address, Reason.Fraud);
    });

    it("stocke le motif lisible pour chaque raison", async function () {
      await issue(issuer, "d2");
      await issue(issuer, "d3");
      await registry.connect(issuer).revokeDiploma(1, Reason.DataEntryError);
      await registry.connect(issuer).revokeDiploma(2, Reason.Fraud);
      await registry.connect(issuer).revokeDiploma(3, Reason.Plagiarism);

      expect((await registry.diplomas(1)).revocationReason).to.equal("DataEntryError");
      expect((await registry.diplomas(2)).revocationReason).to.equal("Fraud");
      expect((await registry.diplomas(3)).revocationReason).to.equal("Plagiarism");
    });

    it("l'événement émet l'émetteur d'origine quand le owner révoque", async function () {
      await expect(registry.connect(owner).revokeDiploma(1, Reason.Plagiarism))
        .to.emit(registry, "Revoked")
        .withArgs(1n, issuer.address, Reason.Plagiarism);
    });

    it("refuse la révocation par un autre émetteur autorisé", async function () {
      await registry.addIssuer(issuer2.address);
      await expect(
        registry.connect(issuer2).revokeDiploma(1, Reason.Fraud)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedRevocation");
    });

    it("refuse un motif hors enum", async function () {
      await expect(registry.connect(issuer).revokeDiploma(1, 3)).to.be.revert(ethers);
    });

    it("le hash reste réservé après révocation (pas de ré-émission)", async function () {
      await registry.connect(issuer).revokeDiploma(1, Reason.Fraud);
      expect(await registry.hashExists(h("d1"))).to.equal(true);
      await expect(
        registry.connect(issuer).issueDiploma(student.address, h("d1"), URI)
      ).to.be.revertedWithCustomError(registry, "DuplicateDiplomaHash");
    });

    it("un émetteur retiré peut encore révoquer ses propres diplômes", async function () {
      await registry.removeIssuer(issuer.address);
      await expect(registry.connect(issuer).revokeDiploma(1, Reason.DataEntryError))
        .to.emit(registry, "Revoked");
    });
  });

  describe("Gestion des émetteurs", function () {
    it("émet IssuerAdded et IssuerRemoved", async function () {
      await expect(registry.addIssuer(issuer2.address))
        .to.emit(registry, "IssuerAdded")
        .withArgs(issuer2.address);
      await expect(registry.removeIssuer(issuer2.address))
        .to.emit(registry, "IssuerRemoved")
        .withArgs(issuer2.address);
    });

    it("refuse removeIssuer par un non-owner", async function () {
      await expect(
        registry.connect(outsider).removeIssuer(issuer.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("peut réautoriser un émetteur retiré", async function () {
      await registry.removeIssuer(issuer.address);
      await registry.addIssuer(issuer.address);
      await issue(issuer, "d1");
      expect((await registry.diplomas(1)).status).to.equal(Status.Valid);
    });
  });

  describe("Rotation d'émetteur", function () {
    it("émet IssuerRemoved, IssuerAdded et IssuerRotated", async function () {
      const tx = registry.rotateIssuer(issuer.address, issuer2.address);
      await expect(tx).to.emit(registry, "IssuerRemoved").withArgs(issuer.address);
      await expect(tx).to.emit(registry, "IssuerAdded").withArgs(issuer2.address);
      await expect(tx)
        .to.emit(registry, "IssuerRotated")
        .withArgs(issuer.address, issuer2.address);
    });

    it("le nouvel émetteur peut émettre, l'ancien non", async function () {
      await registry.rotateIssuer(issuer.address, issuer2.address);
      await issue(issuer2, "d1");
      await expect(
        registry.connect(issuer).issueDiploma(student.address, h("d2"), URI)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedIssuer");
    });

    it("refuse la rotation vers la même adresse", async function () {
      await expect(
        registry.rotateIssuer(issuer.address, issuer.address)
      ).to.be.revertedWithCustomError(registry, "SameIssuerAddress");
    });

    it("refuse la rotation d'un émetteur non autorisé", async function () {
      await expect(
        registry.rotateIssuer(outsider.address, issuer2.address)
      ).to.be.revertedWithCustomError(registry, "IssuerNotAuthorized");
    });

    it("refuse la rotation vers un émetteur déjà autorisé", async function () {
      await registry.addIssuer(issuer2.address);
      await expect(
        registry.rotateIssuer(issuer.address, issuer2.address)
      ).to.be.revertedWithCustomError(registry, "IssuerAlreadyAuthorized");
    });
  });

  describe("Révocation par lot", function () {
    it("émet un événement Revoked par diplôme", async function () {
      await issue(issuer, "d1");
      await issue(issuer, "d2");
      const tx = registry.revokeIssuerDiplomas(issuer.address, [1, 2], Reason.Fraud);
      await expect(tx).to.emit(registry, "Revoked").withArgs(1n, issuer.address, Reason.Fraud);
      await expect(tx).to.emit(registry, "Revoked").withArgs(2n, issuer.address, Reason.Fraud);
      expect((await registry.diplomas(2)).revocationReason).to.equal("Fraud");
    });

    it("accepte exactement 50 diplômes", async function () {
      const ids: number[] = [];
      for (let i = 1; i <= 50; i++) {
        await issue(issuer, `lot-${i}`);
        ids.push(i);
      }
      await registry.revokeIssuerDiplomas(issuer.address, ids, Reason.DataEntryError);
      expect((await registry.diplomas(50)).status).to.equal(Status.Revoked);
    });

    it("refuse un lot de 51 diplômes", async function () {
      const ids = Array.from({ length: 51 }, (_, i) => i + 1);
      await expect(
        registry.revokeIssuerDiplomas(issuer.address, ids, Reason.Fraud)
      ).to.be.revertedWithCustomError(registry, "InvalidBatchSize");
    });

    it("refuse un lot contenant un diplôme inexistant", async function () {
      await issue(issuer, "d1");
      await expect(
        registry.revokeIssuerDiplomas(issuer.address, [1, 99], Reason.Fraud)
      ).to.be.revertedWithCustomError(registry, "DiplomaNotFound");
    });

    it("refuse un lot contenant un diplôme déjà révoqué", async function () {
      await issue(issuer, "d1");
      await issue(issuer, "d2");
      await registry.connect(issuer).revokeDiploma(2, Reason.Fraud);
      await expect(
        registry.revokeIssuerDiplomas(issuer.address, [1, 2], Reason.Fraud)
      ).to.be.revertedWithCustomError(registry, "DiplomaAlreadyRevoked");
    });

    it("annule tout le lot si un diplôme est invalide (atomicité)", async function () {
      await issue(issuer, "d1");
      await issue(issuer, "d2");
      await registry.connect(issuer).revokeDiploma(2, Reason.Fraud);
      await expect(
        registry.revokeIssuerDiplomas(issuer.address, [1, 2], Reason.Fraud)
      ).to.be.revert(ethers);
      expect((await registry.diplomas(1)).status).to.equal(Status.Valid);
    });
  });

  describe("Propriété (Ownable)", function () {
    it("transfère la propriété et applique les nouveaux droits", async function () {
      await registry.transferOwnership(outsider.address);
      await registry.connect(outsider).addIssuer(issuer2.address);
      expect(await registry.authorizedIssuers(issuer2.address)).to.equal(true);
      await expect(
        registry.addIssuer(student.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("renonce à la propriété : plus aucun ajout d'émetteur possible", async function () {
      await registry.renounceOwnership();
      await expect(
        registry.addIssuer(issuer2.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Scénario complet", function () {
    it("autorisation, émission, vérification, révocation, re-vérification", async function () {
      await registry.addIssuer(issuer2.address);
      await registry.connect(issuer2).issueDiploma(student.address, h("final"), URI);

      expect((await registry.verify(1, h("final"))).isValid).to.equal(true);

      await registry.connect(owner).revokeDiploma(1, Reason.Plagiarism);

      const r = await registry.verify(1, h("final"));
      expect(r.isValid).to.equal(false);
      expect(r.status).to.equal(Status.Revoked);
    });
  });
});