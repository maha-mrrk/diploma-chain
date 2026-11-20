import { describe, it } from "mocha";
import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("DiplomaRegistry", function () {

  async function deployFixture() {
    const [owner, issuer, student, outsider] =
      await ethers.getSigners();
    const registry = await ethers.deployContract(
      "DiplomaRegistry"
    );

    await registry.waitForDeployment();

    await registry.connect(owner).addIssuer(issuer.address);

    const diplomaHash = ethers.keccak256(
      ethers.toUtf8Bytes("test diploma")
    );

    return {
      registry,
      owner,
      issuer,
      student,
      outsider,
      diplomaHash,
    };
  }

  it("should authorize an issuer", async function () {
    const { registry, issuer } = await deployFixture();

    assert.equal(
      await registry.authorizedIssuers(issuer.address),
      true
    );
  });

  it("should issue a diploma successfully", async function () {
    const { registry, issuer, student, diplomaHash } =
      await deployFixture();

    await registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://example-diploma"
    );

    const diploma = await registry.diplomas(1);

    assert.equal(diploma.hash, diplomaHash);
    assert.equal(diploma.issuer, issuer.address);
    assert.equal(diploma.student, student.address);
    assert.equal(diploma.status, 1n);
  });

  it("should reject unauthorized issuance", async function () {
    const { registry, outsider, student, diplomaHash } =
      await deployFixture();

    await assert.rejects(
      registry.connect(outsider).issueDiploma(
        student.address,
        diplomaHash,
        "ipfs://example-diploma"
      )
    );
  });

  it("should reject duplicate diploma hashes", async function () {
    const { registry, issuer, student, diplomaHash } =
      await deployFixture();

    await registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://first"
    );

    await assert.rejects(
      registry.connect(issuer).issueDiploma(
        student.address,
        diplomaHash,
        "ipfs://second"
      )
    );
  });

  it("should revoke a diploma by its original issuer", async function () {
    const { registry, issuer, student, diplomaHash } =
      await deployFixture();

    await registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://example-diploma"
    );

    await registry.connect(issuer).revokeDiploma(1, 0);

    const diploma = await registry.diplomas(1);

    assert.equal(diploma.status, 2n);
    assert.equal(diploma.revocationReason, "DataEntryError");
  });

  it("should reject revocation by an outsider", async function () {
    const { registry, issuer, student, outsider, diplomaHash } =
      await deployFixture();

    await registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://example-diploma"
    );

    await assert.rejects(
      registry.connect(outsider).revokeDiploma(1, 0)
    );
  });

  it("should verify a valid diploma", async function () {
    const { registry, issuer, student, diplomaHash } =
      await deployFixture();

    await registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://example-diploma"
    );

    const result = await registry.verify(1, diplomaHash);

    assert.equal(result.isValid, true);
    assert.equal(result.issuer, issuer.address);
    assert.equal(result.status, 1n);
  });


it("should allow the owner to revoke a diploma", async function () {
  const { registry, owner, issuer, student, diplomaHash } =
    await deployFixture();

  await registry.connect(issuer).issueDiploma(
    student.address,
    diplomaHash,
    "ipfs://example"
  );

  await registry.connect(owner).revokeDiploma(1, 1);

  const diploma = await registry.diplomas(1);
  assert.equal(diploma.status, 2n);
  assert.equal(diploma.revocationReason, "Fraud");
});

it("should reject a zero student address", async function () {
  const { registry, issuer, diplomaHash } = await deployFixture();

  await assert.rejects(
    registry.connect(issuer).issueDiploma(
      "0x0000000000000000000000000000000000000000",
      diplomaHash,
      "ipfs://example"
    )
  );
});

it("should reject a zero diploma hash", async function () {
  const { registry, issuer, student } = await deployFixture();

  await assert.rejects(
    registry.connect(issuer).issueDiploma(
      student.address,
      ethers.ZeroHash,
      "ipfs://example"
    )
  );
});

it("should reject an empty metadata URI", async function () {
  const { registry, issuer, student, diplomaHash } =
    await deployFixture();

  await assert.rejects(
    registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      ""
    )
  );
});

it("should return false for an incorrect diploma hash", async function () {
  const { registry, issuer, student, diplomaHash } =
    await deployFixture();

  await registry.connect(issuer).issueDiploma(
    student.address,
    diplomaHash,
    "ipfs://example"
  );

  const wrongHash = ethers.keccak256(
    ethers.toUtf8Bytes("different document")
  );

  const result = await registry.verify(1, wrongHash);
  assert.equal(result.isValid, false);
});

it("should return false after diploma revocation", async function () {
  const { registry, issuer, student, diplomaHash } =
    await deployFixture();

  await registry.connect(issuer).issueDiploma(
    student.address,
    diplomaHash,
    "ipfs://example"
  );

  await registry.connect(issuer).revokeDiploma(1, 2);

  const result = await registry.verify(1, diplomaHash);
  assert.equal(result.isValid, false);
  assert.equal(result.status, 2n);
});

it("should prevent a removed issuer from issuing diplomas", async function () {
  const { registry, owner, issuer, student, diplomaHash } =
    await deployFixture();

  await registry.connect(owner).removeIssuer(issuer.address);

  await assert.rejects(
    registry.connect(issuer).issueDiploma(
      student.address,
      diplomaHash,
      "ipfs://example"
    )
  );
});

it("should reject a second revocation", async function () {
  const { registry, issuer, student, diplomaHash } =
    await deployFixture();

  await registry.connect(issuer).issueDiploma(
    student.address,
    diplomaHash,
    "ipfs://example"
  );

  await registry.connect(issuer).revokeDiploma(1, 0);

  await assert.rejects(
    registry.connect(issuer).revokeDiploma(1, 1)
  );
});


  it("should allow only the owner to add issuers", async function () {
    const { registry, outsider, student } = await deployFixture();

    await assert.rejects(
      registry.connect(outsider).addIssuer(student.address)
    );
  });


  it("should reject revocation of a non-existent diploma", async function () {
    const { registry, issuer } = await deployFixture();

    await assert.rejects(
      registry.connect(issuer).revokeDiploma(999, 0)
    );
  });

  it("should reject adding the zero address as an issuer", async function () {
    const { registry, owner } = await deployFixture();

    await assert.rejects(
      registry.connect(owner).addIssuer(
        "0x0000000000000000000000000000000000000000"
      )
    );
  });

  it("should reject adding an already authorized issuer", async function () {
    const { registry, owner, issuer } = await deployFixture();

    await assert.rejects(
      registry.connect(owner).addIssuer(issuer.address)
    );
  });

  it("should reject removing a non-authorized issuer", async function () {
    const { registry, owner, outsider } = await deployFixture();

    await assert.rejects(
      registry.connect(owner).removeIssuer(outsider.address)
    );
  });

});
