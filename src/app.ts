import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Server } from "socket.io";
import path from "path";
import { createServer } from "http";
import { initSocket } from "./v1/library/sockethandler";

// Get the current directory name
let app=require('./v1/index')



/**
 * env variables Configuration
 */
const result = dotenv.config({ path: path.join(__dirname, '../', '.env') });
if (result.error) throw result.error;

const port: number = Number(process.env.PORT) || 5000;

const httpServer = createServer(app);
// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Call socket initialization function
initSocket(io);
// initSocket(httpServer);

httpServer.listen(port, () => {
  try {
    console.log(`Server is running on port ${port}`);
  } catch (error) {
    console.log("Error", error);
  }
});



export {io}


