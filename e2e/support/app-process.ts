import { generateKeyPairSync, randomUUID } from "crypto";
import { promises as fs } from "fs";
import { ChildProcess, spawn } from "child_process";
import os from "os";
import path from "path";
import { AddressInfo } from "net";
import { createServer } from "net";

const ROOT_DIR = path.resolve(__dirname, "../..");

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getFreePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  return port;
}

export async function createTestPrivateKey() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  const filePath = path.join(
    os.tmpdir(),
    `tradebot-e2e-${randomUUID()}-private-key.pem`
  );

  await fs.writeFile(filePath, privateKey, { encoding: "utf8", mode: 0o600 });

  return {
    filePath,
    cleanup: () => fs.rm(filePath, { force: true }),
  };
}

export class ApplicationProcess {
  private child: ChildProcess | undefined;
  private stdout = "";
  private stderr = "";

  async start(environment: Record<string, string>) {
    if (this.child) {
      throw new Error("Application process is already running");
    }

    const child = spawn(
      process.execPath,
      ["-r", "ts-node/register/transpile-only", "main.ts"],
      {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          ...environment,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    this.child = child;
    child.stdout?.on("data", (chunk) => {
      this.stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });

    await this.waitForOutput(/Server running on port/, 30_000);
  }

  getLogs() {
    const tail = (value: string) =>
      value.length > 12_000
        ? `[...truncated...]\n${value.slice(-12_000)}`
        : value;

    return `stdout:\n${tail(this.stdout)}\nstderr:\n${tail(this.stderr)}`;
  }

  async stop() {
    const child = this.child;
    if (!child) return;

    if (child.exitCode === null) {
      child.kill();

      const deadline = Date.now() + 5_000;
      while (child.exitCode === null && Date.now() < deadline) {
        await delay(50);
      }

      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }

    this.child = undefined;
  }

  private async waitForOutput(pattern: RegExp, timeout: number) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (pattern.test(this.stdout) || pattern.test(this.stderr)) return;

      if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) {
        throw new Error(
          `Application exited before becoming ready.\n${this.getLogs()}`
        );
      }

      await delay(50);
    }

    throw new Error(
      `Timed out waiting for application readiness.\n${this.getLogs()}`
    );
  }
}
