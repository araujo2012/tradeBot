import { Request, Response } from "express";
import { UserModel } from "../../models/user";
import bcrypt from "bcrypt";

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ username, password: hashed });
  res.status(201).json(user);
};

export const listUsers = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const users = await UserModel.find({}, "-password");
  res.json(users);
};

export const getUser = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const user = await UserModel.findById(req.params.id, "-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const update = req.body;
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
  const user = await UserModel.findByIdAndUpdate(req.params.id, update, {
    new: true,
  });
  res.json(user);
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  await UserModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};

export const updateApiCredentials = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    res.status(400).json({ error: "apiKey and apiSecret are required." });
    return;
  }
  const userId: string = (req as any).user.userId;
  await UserModel.findByIdAndUpdate(userId, { apiKey, apiSecret });
  res.status(200).json({ message: "API credentials updated successfully." });
};

export const updateLimit = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId: string = (req as any).user.userId;
  const { limit } = req.body;
  if (typeof limit !== "number") {
    res.status(400).json({ error: "limit must be a number." });
    return;
  }
  await UserModel.findByIdAndUpdate(userId, { limit });
  res.status(200).json({ message: "Limit updated successfully." });
};

export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId: string = (req as any).user.userId;
  const { name, email, phone } = req.body;
  await UserModel.findByIdAndUpdate(userId, { name, email, phone });
  res.status(200).json({ message: "Profile updated successfully." });
};
