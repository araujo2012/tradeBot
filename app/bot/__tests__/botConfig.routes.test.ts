import request from "supertest";
import app from "../../../app";
import { BotConfig } from "../../../models/botConfig";
import { connectToDatabase } from "../../lib/database";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

describe("BotConfig Routes", () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await connectToDatabase();
    testUserId = "test-user-id";

    // Create a test JWT token
    authToken = jwt.sign(
      { userId: testUserId, limit: 100 },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await BotConfig.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await BotConfig.deleteMany({});
  });

  describe("GET /bot/config/default", () => {
    it("should return 401 when no token is provided", async () => {
      const response = await request(app)
        .get("/bot/config/default")
        .expect(401);

      expect(response.body.error).toBe("No token provided");
    });

    it("should return 404 when no default config exists for user", async () => {
      const response = await request(app)
        .get("/bot/config/default")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe("Default configuration not found");
    });

    it("should return default config when it exists", async () => {
      // Create a test config
      const testConfig = new BotConfig({
        userId: testUserId,
        buyProtection: 50,
        sellProtection: 30,
        periodo: 5,
        largura: 3,
        name: "Default Config",
      });
      await testConfig.save();

      const response = await request(app)
        .get("/bot/config/default")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        userId: testUserId,
        buyProtection: 50,
        sellProtection: 30,
        name: "Default Config",
      });
      // Check that periodo and largura are random values within expected ranges
      expect(response.body.data.periodo).toBeGreaterThanOrEqual(0);
      expect(response.body.data.periodo).toBeLessThanOrEqual(10);
      expect(Number.isInteger(response.body.data.periodo)).toBe(true);
      expect(response.body.data.largura).toBeGreaterThanOrEqual(0);
      expect(response.body.data.largura).toBeLessThanOrEqual(10);
      expect(typeof response.body.data.largura).toBe("number");
    });

    it("should return 401 when token is invalid", async () => {
      const invalidToken = "invalid-token";

      const response = await request(app)
        .get("/bot/config/default")
        .set("Authorization", `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.error).toBe("Invalid token");
    });
  });
});
