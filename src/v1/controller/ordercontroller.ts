import express ,{NextFunction} from "express";
import Joi from "joi";
import { functions } from "../library/functions";
import { validations } from "../library/validations";
import { dbcustomers } from "../model/customermodel";
import { authenticateCustomer, dpartnerAuthenticate } from "../../v1/index";
import { dborders} from "../model/ordermodel"// Import necessary functions
import { dbCity } from "../model/citymodel";
import { dbVehicleType } from '../model/vehicletypemodel';
import { dbDpartners } from "../model/dpartnersmodel";
import requestIp from 'request-ip';
import { io } from "../../app";
import { MailService } from "../library/sendMail";

const router = express.Router();
let functionsObj = new functions();
let orderObj= new dborders();
let customerObj= new dbcustomers();
let cityObj = new dbCity();
let dpartnerObj=new dbDpartners()
let VehicletypeObj = new dbVehicleType();
// Route for placing an order
router.post("/place-order", authenticateCustomer, orderSchema, placeOrder);
router.post(
  "/accept-order",
  dpartnerAuthenticate,
 acceptOrder
);
router.post(
  "/verify-pickup-otp",
 dpartnerAuthenticate,
 verifyPickupOtp
);
router.put(
  "/update-status",
 dpartnerAuthenticate,
 updateStatusSchema,
 updateOrderStatus
);
router.get(
  "/get-all-order",

  getAllorders
);
router.get("/get-customer-order", authenticateCustomer, getOrders);


module.exports = router;

// Order schema validation
function orderSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    vehicletype: Joi.string().required().messages({
      "string.empty": "Vehicle type is required.",
    }),
    pickup: Joi.object({
      city: Joi.string().required().messages({
        "string.empty": "Pickup city is required.",
      }),
      flatno: Joi.string().required().messages({
        "string.empty": "Pickup flat number is required.",
      }),
      street: Joi.string().required().messages({
        "string.empty": "Pickup street is required.",
      }),
      landmark: Joi.string().optional(),
      pincode: Joi.string().required().messages({
        "string.empty": "Pickup pincode is required.",
      }),
      phone: Joi.string().required().messages({
        "string.empty": "Pickup phone number is required.",
      }),
      state: Joi.string().required().messages({
        "string.empty": "Pickup state is required.",
      }),
      latitude: Joi.number().required().messages({
        "number.base": "Pickup latitude is required.",
      }),
      longitude: Joi.number().required().messages({
        "number.base": "Pickup longitude is required.",
      }),
    }).required(),
    drop: Joi.object({
      city: Joi.string().required().messages({
        "string.empty": "Drop city is required.",
      }),
      flatno: Joi.string().required().messages({
        "string.empty": "Drop flat number is required.",
      }),
      street: Joi.string().required().messages({
        "string.empty": "Drop street is required.",
      }),
      landmark: Joi.string().optional(),
      pincode: Joi.string().required().messages({
        "string.empty": "Drop pincode is required.",
      }),
      phone: Joi.string().required().messages({
        "string.empty": "Drop phone number is required.",
      }),
      state: Joi.string().required().messages({
        "string.empty": "Drop state is required.",
      }),
      latitude: Joi.number().required().messages({
        "number.base": "Drop latitude is required.",
      }),
      longitude: Joi.number().required().messages({
        "number.base": "Drop longitude is required.",
      }),
    }).required(),
    order_charge: Joi.number().required().messages({
      "number.base": "Order charge is required.",
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// Place Order Controller
async function placeOrder(req: any, res: any, next: any) {
  try {
    const { id } = req.user; // Assuming the user is authenticated and user data is in req.user.data
    const { vehicletype, pickup, drop, order_charge } = req.body;
    if(!req.user.id){
       return res.send(
         functionsObj.output(
           0,
          req.user.message || "user not found."
         )
       );
    }

    // Get the client's IP
      const createdip: string | null = requestIp.getClientIp(req) || "";

   
    // Get Vehicle Type ID
    const vehicletypeany :any = await VehicletypeObj.getVehicleTypeIdByName(vehicletype);

    if (vehicletypeany.error || !vehicletypeany.data) {
      return res.send(
        functionsObj.output(
          0,
          vehicletypeany.message || "Vehicle type not found."
        )
      );
    }

    const vehicletype_id = vehicletypeany;
   // console.log(vehicletype_id.data.id)
    //availabel delivery partner
 const availablePartners :any = await dpartnerObj.getAvailableDPartners();
 if (availablePartners.error) {
   return res.send(
     functionsObj.output(0,availablePartners.message)
   );
 }
    // Place the order
    const orderResponse: any = await orderObj.orderPlace(
      id,
      vehicletype_id.data.id,
      pickup,
      drop,
      order_charge,
      createdip
    );

    if (orderResponse.error || !orderResponse.data) {
      return res.send(
        functionsObj.output(
          0,
          orderResponse.message || "Failed to place order."
        )
      );
    }

     const orderId = orderResponse.data.id;
     let activeDpartners=availablePartners.data

     //  Send Order any to Available Delivery Partners via Socket.io**
   activeDpartners.forEach((partner: any) => {
       io.to(`delivery_partner_${partner.id}`).emit("new_order_any", {
         orderId,
         pickup,
         drop,
         order_charge,
       });
     });

    // Return success any
    return res.send(
      functionsObj.output(1, "Order placed successfully!", orderResponse.data)
    );
  } catch (error: any) {
    console.error("Order Placement Error:", error);
    next(error);
  }
}

// update order status

// Joi schema for status validation
function updateStatusSchema (req: any, res: any, next: any){
  const schema = Joi.object({
    orderId: Joi.number().required().messages({
      "number.base": "Order ID must be a number.",
      "any.required": "Order ID is required.",
    }),
    status: Joi.string()
      .valid("pending", "accepted", "in-progress", "delivered")
      .required()
      .messages({
        "string.base": "Status must be a string.",
        "any.only":
          "Invalid status. Allowed values: pending, accepted, in-progress, delivered.",
        "any.required": "Status is required.",
      }),
  });
let validationsObj = new validations();
 if (!validationsObj.validateRequest(req, res, next, schema)) {
   return;
 }

next();
} 
// Controller function
 // Accept Order (Delivery Partner)
  async function acceptOrder(req: any, res: any) {
    try {
      const { orderId } = req.body;
      const dpartnerId = req.user.id;

      // Fetch order details to get cust_id
      const orderResponse:any = await orderObj.getOrderById(orderId);
      const order: any = orderResponse.data;
    //  console.log(order)
      if (!order || orderResponse?.error) {
        return res.send(functionsObj.output(0, "Order not found."));
      }

      const custId = order.cust_id; // Get customer ID
      // console.log(custId)
      // Fetch customer details to get email
      const customerResponse:any = await customerObj.findUserById(custId);
      const customer: any = customerResponse.data;

      if (!customer || customerResponse?.error) {
        return res.send(functionsObj.output(0, "Customer not found."));
      }

      const customerEmail = customer.cust_email;

      // Assign order to the delivery partner
      let assigndpartner:any= await orderObj.assignDeliveryPartner(orderId, dpartnerId);
 if (assigndpartner.error) {
   return res.send(functionsObj.output(0, assigndpartner.message));
 }

      // generaye otp
      const generateOTP = require("../library/generateOTP");
      let otp: number = generateOTP();
      let otpExpiryTime: string | null = new Date(Date.now() + 60 * 60000)
        .toISOString()
        .replace("T", " ")
        .slice(0, -1);

      const saveOtp= await  orderObj.updateOrderOTP(order.id,otp,otpExpiryTime)
      //console.log(saveOtp)
      if(saveOtp.error){
         return res.send(functionsObj.output(0, saveOtp.message));
      }
      await dpartnerObj.setdPartnerAvailable(dpartnerId, false);
      let mailService = new MailService();
      await mailService.sendOrderOTPMail(orderId, customerEmail, otp);

      // 🔔 Notify customer
      const customerSocketId:any = await orderObj.getCustomerSocketId(
        order.cust_id
      );

      if (customerSocketId?.data.id) {
        io.to(customerSocketId.data.id).emit("order_accepted", { orderId, dpartnerId });
      }

      return res.send(functionsObj.output(1, assigndpartner.message,assigndpartner.data));
    } catch (error) {
      return res.send(functionsObj.output(0, "Error accepting order."));
    }
  }

  // Verify OTP at Pickup
 async function verifyPickupOtp(req: any, res: any) {
    try {
      const { orderId, otp } = req.body;
      const orderResponse :any= await orderObj.getOrderById(orderId);
      const order: any = orderResponse?.data;
      if (orderResponse.error || order.order_verifyotp !== otp) {
        return res.send(functionsObj.output(0, "Invalid OTP."));
      }
      let storedExpiryTime = new Date(order.order_expiryotp + " UTC"); // Force UTC interpretation
      let currentTime = new Date();
      if (currentTime > storedExpiryTime) {
        return res.send(functionsObj.output(0, "OTP is expired."));
      }

      const verifyorder: any = await orderObj.updateOrderStatus(
        orderId,
        "pickup",
        req.user.id
      );
      if (verifyorder.error) {
        return res.send(
          functionsObj.output(0, "OTP not Verified, order picked up.")
        );
      }
      // 🔔 Notify customer
      // const customerSocketId :any= await orderObj.getCustomerSocketId(
      //   order.customer_id
      // );
      // if (customerSocketId.data.id) {
      //   io.to(customerSocketId.data.id).emit("order_status_update", {
      //     orderId,
      //     status: "pickup",
      //   });
      // }

      return res.send(functionsObj.output(1, "OTP Verified, order picked up."));
    } catch (error) {
      return res.send(functionsObj.output(0, "Error verifying OTP."));
    }
  }

  // Update Order Status (In Progress / Delivered)
 async function updateOrderStatus(req: any, res: any) {
    try {
      // const { }=req.params
      const {orderId, status } = req.body;
      const dpartnerId = req.user.id;

      const updateResponse: any = await orderObj.updateOrderStatus(
        orderId,
        status,
        dpartnerId
      );

      if (updateResponse.error) {
        return res.send(functionsObj.output(0, updateResponse.message));
      }
      if (status === "delivered") {
        await dpartnerObj.setdPartnerAvailable(dpartnerId, true);
      }
        const order:any = await orderObj.getOrderById(orderId);

      // 🔔 Notify customer
      const customerSocketId: any = await orderObj.getCustomerSocketId(
        order.data.cust_id
      );
      if (customerSocketId.data.id) {
        io.to(customerSocketId.data.id).emit("order_status_update", {
          orderId,
        
        });
      }

      return res.send(
        functionsObj.output(1, updateResponse.message,updateResponse.data)
      );
    } catch (error) {
      return res.send(functionsObj.output(0, "Error updating order status."));
    }
  }
// get particular customer their order
  async function getOrders(req: any, res: any,next:any) {
   
     try {
       if (!req.user) {
         return res.send(
           functionsObj.output(0, "Unauthorized: No user data found")
         );
       }
 const customerId = req.user.id;
       
       const result = await orderObj.getCustomerOrders(customerId);
       // console.log("Fetched user:", user);

       if (!result || result.error) {
         return res.send(
           functionsObj.output(0, result?.message || "order not found")
         );
       }

       return res.send(functionsObj.output(1, result.message, result.data));
     } catch (error) {
       console.error("Error fetching user:", error);
       return next(error);
     }
  }
// get particular customer their order
  async function getAllorders(req: any, res: any,next:any) {
   
     try {
       
       
       const result = await orderObj.getAllOrders();
      
       if (!result || result.error) {
         return res.send(
           functionsObj.output(0, result?.message || "order not found")
         );
       }

       return res.send(functionsObj.output(1, result.message, result.data));
     } catch (error) {
       console.error("Error fetching user:", error);
       return next(error);
     }
  }


