import { Server } from "socket.io";
import { dborders } from "../model/ordermodel";
import { dbcustomers } from "../model/customermodel";

const customerObj = new dbcustomers();

export function initSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Register customer and store socket ID
    socket.on("register_customer", async (data) => {
      const { customerId } = data;
      await customerObj.updateSocketId(customerId, socket.id);
      console.log(
        `🔹 Customer ${customerId} registered with socket ID: ${socket.id}`
      );
    });

    // Notify when a delivery partner accepts an order
    socket.on("accept_order", (data) => {
      io.emit("order_accepted", data);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(" Client disconnected:", socket.id);
    });
  });
}
