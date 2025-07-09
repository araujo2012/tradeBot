import { Request, Response } from "express";
import { UserModel } from "../../models/user";
import bcrypt from "bcrypt";

export const createUser = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ username, password: hashed });
  res.status(201).json(user);
};

export const listUsers = async (_req: Request, res: Response) => {
  const users = await UserModel.find({}, "-password");
  res.json(users);
};

export const getUser = async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id, "-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
};

export const updateUser = async (req: Request, res: Response) => {
  const update = req.body;
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
  const user = await UserModel.findByIdAndUpdate(req.params.id, update, {
    new: true,
  });
  res.json(user);
};

export const deleteUser = async (req: Request, res: Response) => {
  await UserModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
