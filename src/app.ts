import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Server } from "socket.io";
import path from "path";
import { createServer } from "http";
import { initSocket } from "./v1/library/sockethandler";


let app=require('./v1/index')

const result = dotenv.config({ path: path.join(__dirname, '../', '.env') });
if (result.error) throw result.error;

const port: number = Number(process.env.PORT) || 5000;

const httpServer = createServer(app);
const io = new Server(httpServer,
  {
    cors: {
      origin: ['http://localhost:4200'],  // ✅ Ensure this matches your frontend URL exactly
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'], // ✅ These are correct
      exposedHeaders: ['Authorization'], // ✅ Allow frontend to access Authorization header
      credentials: true
    },
      
}
);

initSocket(io);

httpServer.listen(port, () => {
  try {
    console.log(`Server is running on port ${port}`);
  } catch (error) {
    console.log("Error", error);
  }
});



export {io}


