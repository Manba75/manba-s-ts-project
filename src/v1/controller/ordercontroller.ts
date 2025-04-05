import express, { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { functions } from "../library/functions";
import { validations } from "../library/validations";
import { dbcustomers } from "../model/customermodel";
import { authenticateCustomer, dpartnerAuthenticate } from "../../v1/index";
import { dborders } from "../model/ordermodel";
import { dbCity } from "../model/citymodel";
import { dbVehicleType } from '../model/vehicletypemodel';
import { dbDpartners } from "../model/dpartnersmodel";
import requestIp from 'request-ip';
import { io } from "../../app";
import { MailService } from "../library/sendMail";
import { generateOTP } from "../library/generateOTP";

const router = express.Router();

router.post("/place-order", authenticateCustomer, orderSchema, placeOrder);
router.post("/accept-order", dpartnerAuthenticate, acceptOrder);
router.post("/verify-pickup-otp", dpartnerAuthenticate, verifyPickupOtp);
router.put("/update-status", dpartnerAuthenticate, updateStatusSchema, updateOrderStatus);
router.get("/get-orders", getAllorders);
router.get("/get-customer-order", authenticateCustomer, getOrders);
router.get("/get-order-by-id/:id", authenticateCustomer, getOrderById);

module.exports = router;

// Order schema validation
function orderSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    vehicletype: Joi.string().required().messages({ "string.empty": "Vehicle type is required." }),
    pickup: Joi.object({
      city: Joi.string().required().messages({ "string.empty": "Pickup city is required." }),
      flatno: Joi.string().required().messages({ "string.empty": "Pickup flat number is required." }),
      street: Joi.string().required().messages({ "string.empty": "Pickup street is required." }),
      landmark: Joi.string().optional(),
      pincode: Joi.string().required().messages({ "string.empty": "Pickup pincode is required." }),
      phone: Joi.string().required().messages({ "string.empty": "Pickup phone number is required." }),
      state: Joi.string().required().messages({ "string.empty": "Pickup state is required." }),
      latitude: Joi.number().required().messages({ "number.base": "Pickup latitude is required." }),
      longitude: Joi.number().required().messages({ "number.base": "Pickup longitude is required." }),
    }).required(),
    
    drop: Joi.object({
      city: Joi.string().required().messages({ "string.empty": "Drop city is required." }),
      flatno: Joi.string().required().messages({ "string.empty": "Drop flat number is required." }),
      street: Joi.string().required().messages({ "string.empty": "Drop street is required." }),
      landmark: Joi.string().optional(),
      pincode: Joi.string().required().messages({ "string.empty": "Drop pincode is required." }),
      phone: Joi.string().required().messages({ "string.empty": "Drop phone number is required." }),
      state: Joi.string().required().messages({ "string.empty": "Drop state is required." }),
      latitude: Joi.number().required().messages({ "number.base": "Drop latitude is required." }),
      longitude: Joi.number().required().messages({ "number.base": "Drop longitude is required." }),
    }).required(),
    // order_charge: Joi.number().required().messages({ "number.base": "Order charge is required." }),
  });

  const validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// Place Order Controller
async function placeOrder(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  const VehicletypeObj = new dbVehicleType();
  const dpartnerObj = new dbDpartners();
  try {
    const { id } = req.body.user;
    const { vehicletype, pickup, drop } = req.body;
    if (!req.body.user.id) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND"));
      return;
    }

    const createdip: string | null = requestIp.getClientIp(req) || "";

   

    // const vehicletype_id = vehicletypes.data.id;
    const availablePartners: any = await dpartnerObj.getAvailableDPartners();
    if (availablePartners.error) {
      res.send(functionsObj.output(0, "DPARTNER_AVAILABILITY_ERROR"));
      return;
    }
    // let order_charge= vehicletype.data.vehicletype_price;

    let orderResponse: any = await orderObj.orderPlace(id, vehicletype,pickup, drop, createdip);

    if (orderResponse.error || !orderResponse.data) {
      res.send(functionsObj.output(0, orderResponse.message));
      return;
    }
  
   

    res.send(functionsObj.output(1, orderResponse.message, orderResponse.data));
    return;
  } catch (error: any) {
    next(error);
  }
}

// Joi schema for status validation
function updateStatusSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    orderId: Joi.number().required().messages({
      "number.base": "Order ID must be a number.",
      "any.required": "Order ID is required.",
    }),
    status: Joi.string().valid("pending", "accepted","pickup","in-progress", "delivered").required().messages({
      "string.base": "Status must be a string.",
      "any.only": "Invalid status. Allowed values: pending, accepted,pickup, in-progress, delivered.",
      "any.required": "Status is required.",
    }),
  });

  const validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// Accept Order (Delivery Partner)
async function acceptOrder(req: Request, res: Response) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  const customerObj = new dbcustomers();
  const dpartnerObj = new dbDpartners();
  
  try {
    const { orderId } = req.body;
    const dpartnerId = req.body.user.id;
   
    let acceptorderResponse: any = await orderObj.acceptOrder(orderId, dpartnerId);
    if (acceptorderResponse.error) {
      res.send(functionsObj.output(0, acceptorderResponse.message));
      return;
    }
    let order= acceptorderResponse.data
    console.log("order",acceptorderResponse)
    // Emit Event to Customer via Socket.io
    // const customerSocketId: any = await customerObj.getCustomerSocketId(order.cust_id);
    // if (customerSocketId?.data?.id) {
    //   io.to(customerSocketId.data.id).emit("order_accepted", { orderId, dpartnerId });
    // }

    // Return Response
    res.send(functionsObj.output(1, "ORDER_ACCEPTED_SUCCESSFULLY", acceptorderResponse.data));
    return
  } catch (error) {
    console.error("Order Accept Error:", error);
    res.send(functionsObj.output(0, "ORDER_ACCEPT_ERROR"));
    return
  }
}

// Verify OTP at Pickup
async function verifyPickupOtp(req: Request, res: Response) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  try {
    const { orderId, otp } = req.body;
   

    const verifyorder: any = await orderObj.verifypickupOTP(orderId, otp );
    if (verifyorder.error) {
      res.send(functionsObj.output(0, verifyorder.message,verifyorder.message));
      return;
    }
    
    // const customerSocketId :any= await customerObj.getCustomerSocketId(
    //   order.customer_id
    // );
    // if (customerSocketId.data.id) {
    //   io.to(customerSocketId.data.id).emit("order_status_update", {
    //     orderId,
    //     status: "pickup",
    //   });
    // }
    res.send(functionsObj.output(1, verifyorder.message, verifyorder.data));
    return;
  } catch (error) {
    res.send(functionsObj.output(0, "OTP_VERIFY_ERROR"));
    return;
  }
}

// Update Order Status (In Progress / Delivered)
async function updateOrderStatus(req: Request, res: Response) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  const dpartnerObj = new dbDpartners();
  const customerObj = new dbcustomers();
  try {
    const { orderId, status } = req.body;
    const dpartnerId = req.body.user.id;

    const updateResponse: any = await orderObj.updateOrderStatus(orderId, status, dpartnerId);

    if (updateResponse.error) {
      res.send(functionsObj.output(0, "ORDER_UPDATE_ERROR"));
      return;
    }

    if (status === "delivered") {
      await dpartnerObj.setdPartnerAvailable(dpartnerId, true);
    }

    const order: any = await orderObj.getOrderById(orderId);

    // const customerSocketId: any = await customerObj.getCustomerSocketId(order.data.cust_id);
    // if (customerSocketId.data.id) {
    //   io.to(customerSocketId.data.id).emit("order_status_update", { orderId });
    // }

    res.send(functionsObj.output(1, "ORDER_UPDATE_SUCCESS", updateResponse.data));
    return;
  } catch (error) {
    res.send(functionsObj.output(0, "ORDER_UPDATE_ERROR."));
    return;
  }
}

// Get particular customer their order
async function getOrders(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  try {
    if (!req.body.user) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND"));
      return;
    }

    const customerId = req.body.user.id;
    console.log("cust",customerId)
    const result = await orderObj.getCustomerOrders(customerId);

    if (!result || result.error) {
      res.send(functionsObj.output(0, "ORDER_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "ORDER_FETCH_SUCCESS", result.data));
    return;
  } catch (error) {
    console.error("ORDER_NOT_FOUND", error);
    next(error);
  }
}

// Get all orders
async function getAllorders(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  try {
    const result = await orderObj.getAllOrders();

    if (!result || result.error) {
      res.send(functionsObj.output(0, "ORDER_NOT_FOUND"));
      return;
    }
    let orders=result.data
    res.send(functionsObj.output(1, "ORDERS_FETCH_SUCCESS", orders));
    return;
  } catch (error) {
    console.error("Error fetching user:", error);
    next(error);
  }
}

// get  order by id 
async function getOrderById(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const orderObj = new dborders();

  try {
  let orderId = parseInt(req.params.id); 
    const result :any = await orderObj.getOrderById(orderId); 

    if (!result || result.error) {
      res.send(functionsObj.output(0, "ORDER_NOT_FOUND")); 
      return;
    }

    res.send(functionsObj.output(1, "ORDER_FETCH_SUCCESS", result.data));
  } catch (error) {
    console.error("ORDER_FETCH_ERROR", error);
    next(error); 
  }
}
