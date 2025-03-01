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
router.get("/get-all-order", getAllorders);
router.get("/get-customer-order", authenticateCustomer, getOrders);

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
    order_charge: Joi.number().required().messages({ "number.base": "Order charge is required." }),
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
    const { vehicletype, pickup, drop, order_charge } = req.body;
    if (!req.body.user.id) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND"));
      return;
    }

    const createdip: string | null = requestIp.getClientIp(req) || "";

    const vehicletypeany: any = await VehicletypeObj.getVehicleTypeIdByName(vehicletype);

    if (vehicletypeany.error || !vehicletypeany.data) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    const vehicletype_id = vehicletypeany;
    const availablePartners: any = await dpartnerObj.getAvailableDPartners();
    if (availablePartners.error) {
      res.send(functionsObj.output(0, "DPARTNER_AVAILABILITY_ERROR"));
      return;
    }

    const orderResponse: any = await orderObj.orderPlace(id, vehicletype_id.data.id, pickup, drop, order_charge, createdip);

    if (orderResponse.error || !orderResponse.data) {
      res.send(functionsObj.output(0, "ORDER_INSERT_ERROR"));
      return;
    }

    const orderId = orderResponse.data.id;
    let activeDpartners = availablePartners.data;

    activeDpartners.forEach((partner: any) => {
      io.to(`delivery_partner_${partner.id}`).emit("new_order_any", {
        orderId,
        pickup,
        drop,
        order_charge,
      });
    });

    res.send(functionsObj.output(1, "ORDER_INSERT_SUCCESS", orderResponse.data));
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
    status: Joi.string().valid("pending", "accepted", "in-progress", "delivered").required().messages({
      "string.base": "Status must be a string.",
      "any.only": "Invalid status. Allowed values: pending, accepted, in-progress, delivered.",
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
   

    const orderResponse: any = await orderObj.getOrderById(orderId);
    const order: any = orderResponse.data;

    if (!order || orderResponse?.error) {
      res.send(functionsObj.output(0, "ORDER_NOT_FOUND"));
      return;
    }

    const custId = order.cust_id;
    const customerResponse: any = await customerObj.findUserById(custId);
    const customer: any = customerResponse.data;

    if (!customer || customerResponse?.error) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND"));
      return;
    }

    const customerEmail = customer.cust_email;

    let assigndpartner: any = await orderObj.assignDeliveryPartner(orderId, dpartnerId);
    if (assigndpartner.error) {
      res.send(functionsObj.output(0, "DPARTNER_AVAILABILITY_ERROR"));
      return;
    }

    let otp: number = generateOTP();
    let otpExpiryTime: string | null = new Date(Date.now() + 60 * 60000).toISOString().replace("T", " ").slice(0, -1);

    const saveOtp = await orderObj.updateOrderOTP(order.id, otp, otpExpiryTime);
    if (saveOtp.error) {
      res.send(functionsObj.output(0, saveOtp.message));
      return;
    }

    await dpartnerObj.setdPartnerAvailable(dpartnerId, false);
    let mailService = new MailService();
    await mailService.sendOrderOTPMail(orderId, customerEmail, otp);

    const customerSocketId: any = await customerObj.getCustomerSocketId(order.cust_id);
    if (customerSocketId?.data.id) {
      io.to(customerSocketId.data.id).emit("order_accepted", { orderId, dpartnerId });
    }

    res.send(functionsObj.output(1, "DPARTNER_AVAILABILITY_SUCCESS", assigndpartner.data));
    return;
  } catch (error) {
    res.send(functionsObj.output(0, "ORDER_FETCH_ERROR"));
    return;
  }
}

// Verify OTP at Pickup
async function verifyPickupOtp(req: Request, res: Response) {
  const functionsObj = new functions();
  const orderObj = new dborders();
  try {
    const { orderId, otp } = req.body;
    const orderResponse: any = await orderObj.getOrderById(orderId);
    const order: any = orderResponse?.data;

    if (orderResponse.error || order.order_verifyotp !== otp) {
      res.send(functionsObj.output(0, "INVALID_OTP"));
      return;
    }

    let storedExpiryTime = new Date(order.order_expiryotp + " UTC");
    let currentTime = new Date();
    if (currentTime > storedExpiryTime) {
      res.send(functionsObj.output(0, "OTP is expired."));
      return;
    }

    const verifyorder: any = await orderObj.updateOrderStatus(orderId, "pickup", req.body.user.id);
    if (verifyorder.error) {
      res.send(functionsObj.output(0, "OTP_VERIFY_ERROR",verifyorder.message));
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
    res.send(functionsObj.output(1, "OTP_VERIFY_SUCCESS",verifyorder.data));
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

    const customerSocketId: any = await customerObj.getCustomerSocketId(order.data.cust_id);
    if (customerSocketId.data.id) {
      io.to(customerSocketId.data.id).emit("order_status_update", { orderId });
    }

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

    res.send(functionsObj.output(1, "ORDERS_FETCH_SUCCESS", result.data));
    return;
  } catch (error) {
    console.error("Error fetching user:", error);
    next(error);
  }
}