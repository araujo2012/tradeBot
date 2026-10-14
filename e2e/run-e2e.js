const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : npmCommand;
  const commandArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    shell: !npmExecPath && process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    return 1;
  }

  return result.status === null ? 1 : result.status;
}

let exitCode = 1;

try {
  exitCode = runNpm(["run", "test:e2e:infra:up"]);
  if (exitCode === 0) {
    exitCode = runNpm(["run", "test:e2e:spec"]);
  }
} finally {
  const teardownCode = runNpm(["run", "test:e2e:infra:down"]);
  if (exitCode === 0 && teardownCode !== 0) {
    exitCode = teardownCode;
  }
}

process.exitCode = exitCode;
