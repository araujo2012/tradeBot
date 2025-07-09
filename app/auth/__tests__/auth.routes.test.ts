import request from "supertest";
import app from "../../../app";
import { UserModel } from "../../../models/user";
import bcrypt from "bcrypt";

describe("Auth Routes", () => {
  beforeAll(async () => {
    const password = await bcrypt.hash("123456", 10);
    await UserModel.create({ username: "testuser", password });
  });

  it("should login and return token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "testuser", password: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail with invalid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "testuser", password: "wrong" });

    expect(res.status).toBe(401);
  });
});
