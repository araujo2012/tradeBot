import { Request, Response } from "express";
import { SessionModel } from "../../models/session";

export async function getSessions(req: Request, res: Response) {
  const userId = req.user?.userId;
  const sessions = await SessionModel.find({ userId });
  res.json(sessions);
}

export async function createSession(req: Request, res: Response) {
  const userId = req.user?.userId;
  const session = await SessionModel.create({ ...req.body, userId });
  res.status(201).json(session);
}

export async function updateSession(
  req: Request,
  res: Response
): Promise<Response | void> {
  const userId = req.user?.userId;
  const session = await SessionModel.findOneAndUpdate(
    { _id: req.params.id, userId },
    req.body,
    { new: true }
  );
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
}

export async function deleteSession(
  req: Request,
  res: Response
): Promise<Response | void> {
  const userId = req.user?.userId;
  const result = await SessionModel.findOneAndDelete({
    _id: req.params.id,
    userId,
  });
  if (!result) return res.status(404).json({ error: "Session not found" });
  res.status(204).send();
}
