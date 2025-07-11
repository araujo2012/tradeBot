import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserModel } from "../../models/user";

const JWT_SECRET = process.env.JWT_SECRET || "segredo_super_secreto";

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await UserModel.findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user?.password || "");
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user._id, limit: user.limit }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token });
};
