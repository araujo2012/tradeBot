import request from "supertest";
import app from "../../../app";
import { UserModel } from "../../../models/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "segredo_super_secreto";

describe("User Routes", () => {
  let token: string;

  beforeAll(async () => {
    const password = await bcrypt.hash("admin", 10);
    const user = await UserModel.create({ username: "admin", password });
    token = jwt.sign({ userId: user._id }, JWT_SECRET);
  });

  it("should create a new user", async () => {
    const res = await request(app).post("/users").send({
      username: "novo",
      password: "abc123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
  });

  it("should list users when authenticated", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should reject listing users without token", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(401);
  });
});
