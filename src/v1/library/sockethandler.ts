import { Server } from "socket.io";
import { dbcustomers } from "../model/customermodel";
import { dbDpartners } from "../model/dpartnersmodel";

const customerObj = new dbcustomers();
const dpartnerObj = new dbDpartners();

// In-memory notifications store
const notifications: Record<string, any[]> = {}; // { customerId: [notifications] }

export function initSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    // Register customer socket ID
    socket.on("register_customer", async ({ id }) => {
      if (id) {
        const updated = await customerObj.updateSocketId(id, socket.id);
        if (updated) {
          console.log(`✅ Customer ${id} linked to socket ID: ${socket.id}`);
          notifications[id] = notifications[id] || []; // Initialize notifications array if not exists
        } else {
          console.error(`❌ Failed to update socket ID for Customer ${id}`);
        }
      }
    });

    // Register delivery partner socket ID and join the room
    socket.on("register_dpartner", async ({ id }) => {
      if (id) {
        const updated = await dpartnerObj.updateDpartnerSocketId(id, socket.id);
        if (updated) {
          console.log(`✅ Delivery Partner ${id} joined room: available_partners`);
          socket.join("available_partners"); // ✅ Join the room
        } else {
          console.error(`❌ Failed to update socket ID for Delivery Partner ${id}`);
        }
      }
    });

    // Handling order placement and broadcasting to delivery partners
    socket.on("order_placed", async (orderData) => {
      console.log("New Order Placed:", orderData);

      const activeDpartners: any = await dpartnerObj.getActiveDPartners();
      if (!activeDpartners || !Array.isArray(activeDpartners.data) || activeDpartners.data.length === 0) {
        console.warn(" No active delivery partners found!");
        return;
      }

      // Send order to all delivery partners
      console.log(`Sending order to "available_partners" room.`);
      io.to("available_partners").emit("new_order", {
        orderData,
        message: "New order available!",
      });
    });

    // Order acceptance notification
    socket.on("order_accepted", async (orderData) => {
      console.log("Order Accepted:", orderData);

      const { id, cust_id, dpartnerId } = orderData;
      if (!id || !cust_id || !dpartnerId) {
        console.error("Missing order details in order_accepted event.");
        return;
      }

      const customer: any = await customerObj.findUserById(cust_id);
      if (!customer || !customer.data.socket_id) {
        console.warn(` Customer ${cust_id} has no socket ID.`);
        return;
      }

      const notification = {
        type: "order_accepted",
        message: "Your order has been accepted!",
        timestamp: new Date(),
      };

      notifications[cust_id] = notifications[cust_id] || [];
      notifications[cust_id].push(notification);

      // // Emit notification and order acceptance event
      io.to(customer.data.socket_id).emit("new_notification", notification);
      io.to(customer.data.socket_id).emit("order_accepted",{ orderData,message:"Your order has been accepted!"}); 
    });

    // Order status update notification
    socket.on("order_update_status", async (orderData) => {
      console.log("Order Status Update:", orderData);

      const { id, cust_id,  order_status } = orderData;
      if (!id || !cust_id) {
        console.error(" Missing order details in order_update_status event.");
        return;
      }

      const customer: any = await customerObj.findUserById(cust_id);
      if (!customer || !customer.data.socket_id) {
        console.warn(` Customer ${cust_id} has no socket ID.`);
        return;
      }

      const notification = {
        type: "order_update_status",
        message: ` Your order status is now: ${order_status}`,
        timestamp: new Date(),
      };

      notifications[cust_id] = notifications[cust_id] || [];
      notifications[cust_id].push(notification);

      
      io.to(customer.data.socket_id).emit("update_order_status", {orderdata:orderData,message:`Your order status has been updated! ${order_status}`});
    });

   
    socket.on("get_notifications", ({ id }) => {
      if (!id) return;
      socket.emit("notification_list", notifications[id] || []);
    });

   
    socket.on("disconnect", async () => {
      console.log(` Client disconnected: ${socket.id}`);

      const customer = await customerObj.getCustomerBySocketId(socket.id);
      if (customer?.data?.id) {
        console.log(`Removing Customer ${customer.data.id} socket ID`);
        await customerObj.removeCustomerSocketId(customer.data.id);
      }

      const dpartner = await dpartnerObj.getDpartnerBySocketId(socket.id);
      if (dpartner?.data?.id) {
        console.log(` Removing Delivery Partner ${dpartner.data.id} from "available_partners"`);
        await dpartnerObj.removeSocketId(dpartner.data.id);
        socket.leave("available_partners");
      }
    });
  });
}
