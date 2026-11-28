
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DiplomaRegistryModule = buildModule(
  "DiplomaRegistryModule",
  (m) => {
    const diplomaRegistry = m.contract("DiplomaRegistry");

    return { diplomaRegistry };
  }
);

export default DiplomaRegistryModule;
