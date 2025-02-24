import express from "express";
import cors from "cors";
import { Request ,Response,NextFunction } from "express";
import { dbcustomers } from "./model/customermodel";
import { functions } from "./library/functions";
import  jwt  from "jsonwebtoken";
// import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { dbDpartners } from "./model/dpartnersmodel";
// import orderRoutes from "./orderRoutes.js";
// import cityRoutes from "./cityRoutes.js";
// import vehicleTypeRoutes from "./vehicleTypeRoutes.js";
// import customerRoute from "./controller/customercontroller";
// import deliveryPartnerRoutes from "./deliveryPartnerRoutes.js";
// import { dbDpartners } from './model/dpartnersmodel';
let  app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

var customersObj=new  dbcustomers();
var functionsObj = new functions();
var dpartnerObj= new dbDpartners();

 /**
//    * Authenticate customer Middleware
//    * @param req Express Request
//    * @param res Express Response
//    * @param next Express NextFunction
//    */

export async function  authenticateCustomer(req: any, res: any, next: any) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      const token =
        req.cookies.token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return_data.message = "Missing token";
        return res.send(functionsObj.output(0, return_data.message));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

      if (!decoded || typeof decoded !== "object" || !decoded.id) {
        return_data.message = "Invalid token";
       return res.send(functionsObj.output(0, return_data.message));
      }

      const user = await customersObj.findUserById(decoded.id);


      if (!user) {
        return_data.message = "User not found";
         return res.send(functionsObj.output(0, return_data.message));
      }

       (req as any).user = user.data;
     next();
    } catch (error) {
      console.error("Token verification error:", error);
      return_data.message = "Unauthorized";
      return  res.send(functionsObj.output(0, return_data.message));
    }
  }

//   /**
//    * Authenticate Delivery Partner Middleware
//    * @param req Express Request
//    * @param res Express Response
//    * @param next Express NextFunction
//    */
export async function  dpartnerAuthenticate(req: any, res: any, next: any) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      const token =
        req.cookies.token || req.headers.authorization?.split(" ")[1];

      if (!token) {
         return_data.message = "Missing token";
         return res.send(functionsObj.output(0, return_data.message));;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

      if (!decoded || typeof decoded !== "object" || !decoded.id) {
         return_data.message = "Invalid token";
         return res.send(functionsObj.output(0, return_data.message));
      }

      const user = await dpartnerObj.finddpartnerById(decoded.id);
      // console.log("user",user)
      if (!user) {
       return_data.message = "User not found";
       return res.send(functionsObj.output(0, return_data.message));
      }

      (req as any).user = user.data;
      // console.log("Authenticated Delivery Partner:", req.user);
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      return_data.message = "Unauthorized";
      return res.send(functionsObj.output(0, return_data.message));
    }
  }


let customerRoute= require("./controller/customercontroller")
app.use("/v1/customer",customerRoute)

let cityRoute=require('./controller/citycontroller');
app.use("/v1/city",cityRoute)

let vehicletypeRoute = require("./controller/vehicletypecontroller");
app.use("/v1/vehicletypes", vehicletypeRoute);

let dpartnersRoute = require("./controller/dpartnercontroller");
app.use("/v1/dpartner", dpartnersRoute);

let ordersRoute = require("./controller/ordercontroller");
app.use("/v1/order", ordersRoute);

module.exports  = app;

