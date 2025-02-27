import { Request } from "express";

export interface CustomRequestHandler {
  Request?: Request;
  user?: any | { id: number; email: string; isVerified: boolean };
  // req:req;
  body: any;
}
