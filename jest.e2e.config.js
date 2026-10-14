module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/e2e"],
  testMatch: ["**/*.e2e.test.ts"],
  setupFiles: ["<rootDir>/e2e/setup-env.ts"],
  maxWorkers: 1,
  testTimeout: 90_000,
};
