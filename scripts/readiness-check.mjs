import { execFileSync } from "node:child_process";

const checks = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["py", ["-3", "-m", "pytest", "contracts\\slaproof_rpc_verifier"]],
  [
    "py",
    [
      "-3",
      "-m",
      "py_compile",
      "contracts\\slaproof_rpc_verifier\\main.py",
      "contracts\\slaproof_rpc_verifier\\evaluator.py",
    ],
  ],
];

for (const [command, args] of checks) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}

console.log("\nSLAProof readiness checks passed.");

