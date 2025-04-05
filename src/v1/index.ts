import express from "express";
import cors from "cors";
import { Request, Response, NextFunction } from "express";
import { dbcustomers } from "./model/customermodel";
import { functions } from "./library/functions";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { dbDpartners } from "./model/dpartnersmodel";


let app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:4200',  
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'], 
  exposedHeaders: ['Authorization'], 
  credentials: true  
  
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

var customersObj = new dbcustomers();
var dpartnerObj = new dbDpartners();


export async function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
  let return_data = {
    error: true,
    message: "",
    data: {},
  };

  const functionsObj = new functions();

  try {
    const token = req.headers["authorization"]?.split(" ")[1] || req.cookies.token;
    if (!token) {
      return_data.message = "Missing token";
      res.send(functionsObj.output(0, return_data.message));
      return ;
    }

    const decoded = jwt.verify( token, process.env.JWT_SECRET as string);
 

    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return_data.message = "Invalid token";
       res.send(functionsObj.output(0, return_data.message));
       return;
    }
    const user = await customersObj.findUserById(decoded.id);

    if (!user) {
      return_data.message = "User not found";
      res.send(functionsObj.output(0, return_data.message));
      return;
    }

    req.body.user = user.data;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return_data.message = "Unauthorized";
    res.send(functionsObj.output(0, return_data.message));
    return
  }
}



export async function dpartnerAuthenticate(req: Request, res: Response, next: NextFunction) {
  let return_data = {
    error: true,
    message: "",
    data: {},
  };

  const functionsObj = new functions();

  try {
    const token = req.headers["authorization"]?.split(" ")[1] || req.cookies.token;
    if (!token) {
      return_data.message = "Missing token";
      res.send(functionsObj.output(0, return_data.message));
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    console.log("Decoded token:", decoded); // Debugging line
    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return_data.message = "Invalid token";
      res.send(functionsObj.output(0, return_data.message));
      return;
    }

    const user = await dpartnerObj.finddpartnerById(decoded.id);
    if (!user) {
      return_data.message = "User not found";
      res.send(functionsObj.output(0, return_data.message));
      return;
    }

    req.body.user = user.data;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return_data.message = "Unauthorized";
    res.send(functionsObj.output(0, return_data.message));
    return;
  }
}

app.use("/v1/customer", require("./controller/customercontroller"));
app.use("/v1/city", require('./controller/citycontroller'));
app.use("/v1/vehicletype", require("./controller/vehicletypecontroller"));
app.use("/v1/dpartner", require("./controller/dpartnercontroller"));
app.use("/v1/order", require("./controller/ordercontroller"));

module.exports = app;