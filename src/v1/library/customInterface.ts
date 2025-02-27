import { Request, Response, NextFunction } from "express";

export interface CustomRequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
}