import { functions } from "../library/functions";
import { validations } from "../library/validations";
import express, { NextFunction, Request, Response } from "express";
import Joi from "joi";
import requestIp from "request-ip";
import bcrypt from "bcrypt";
import { MailService } from "../library/sendMail";
import { generateTokenAndSetCookies } from "../library/generateTokenAndSetCookies";
import jwt from "jsonwebtoken";
import { dpartnerAuthenticate } from "../../v1/index";
import { dbDpartners } from "../model/dpartnersmodel";
import { dbCity } from "../model/citymodel";
import { dbVehicleType } from "../model/vehicletypemodel";
import { generateOTP } from "../library/generateOTP";

const router = express.Router();

router.post("/signup", signupSchema, signup);
router.post("/verify-otp",verifyOTPSchema, verifydpartnerOTP);
router.post("/resend-otp", resendOTPSchema, resendOTPController);
router.post("/login", loginSchema, login);
router.post("/forgot-password", emailSchema, forgotPassword);
router.post("/reset-password", resetPasswordSchema, resetPassword);
router.get("/get-dpartners", getAlldpartners);
router.get("/get-profile/:id", dpartnerAuthenticate, getOnedpartner);
router.put("/update-profile", dpartnerAuthenticate, updateProfileSchema, updatedpartnerProfile);
router.post("/check-email", emailSchema, checkEmail);
router.put("/delete-profile/:id", dpartnerAuthenticate, deletedpartner);
router.put("/isAvailable", dpartnerAuthenticate, AvailabilitySchema, dpartnerIsAvailable);

module.exports = router;

function signupSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    dpartner_email: Joi.string().trim().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().required().trim().replace(/'/g, "").messages({
      "string.empty": "email must be required",
      "string.email": "Invalid email format"
    }),
    dpartner_pass: Joi.string().trim().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().replace(/'/g, "").messages({
      "string.base": "Password must be a string",
      "string.empty": "Password is required",
      "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
    }),
    city: Joi.string().min(3).max(50).required().trim().replace(/'/g, "").messages({
      "string.base": "City name should be a string",
      "string.empty": "City name is required",
      "string.min": "City name should be at least 3 characters long",
      "string.max": "City name should not be longer than 50 characters"
    }),
    dpartner_licence: Joi.string().alphanum().min(10).max(15).required().trim().replace(/'/g, "").messages({
      "string.base": "License number should be a string",
      "string.empty": "License number is required",
      "string.alphanum": "License number must be alphanumeric",
      "string.min": "License number should be at least 10 characters long",
      "string.max": "License number should not exceed 15 characters"
    }),
    vehicle_name: Joi.string().trim().replace(/'/g, "").messages({
      "string.empty": "License number is required"
    }),
    vehicletype: Joi.string().messages({
      "string.empty": "vehicle type must be required"
    }),
    vehicle_number: Joi.string().trim().replace(/'/g, "").messages({
      "string.empty": "License number is required"
    }),
    dpartner_phone: Joi.string().replace(/'/g, "").trim().max(10).pattern(/^[0-9]+$/).required().messages({
      "string.empty": "Phone number is required",
      "string.length": "Phone number must be exactly 10 digits",
      "string.pattern.base": "Phone number must only contain numbers"
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { city, vehicletype, dpartner_email, dpartner_pass, dpartner_licence, dpartner_phone, vehicle_number, vehicle_name } = req.body;
    
    const createdip: string = requestIp.getClientIp(req) || "";
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(dpartner_pass, 10);
    
    let dpartnerObj = new dbDpartners();
    let mailService = new MailService();
    let functionsObj = new functions();

    // Call insertDpartner and get result
    let result :any= await dpartnerObj.insertDpartner(city, vehicletype, dpartner_email, hashpassword, createdip, dpartner_licence, dpartner_phone, vehicle_number, vehicle_name, otp);
    console.log(result.data);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }

    // Send OTP mail
    await mailService.sendOTPMail(dpartner_email, otp);
    
    // Generate token & set cookie
    
 
    res.send(functionsObj.output(1, result.message, {user:result.data}));
  } catch (error: any) {
    next(error);
  }
}


function verifyOTPSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({
      "string.empty": "Email is required.",
      "string.email": "Invalid email format."
    }),
    otp: Joi.number().integer().min(100000).max(999999).required().messages({
      "number.base": "OTP must be a number",
      "number.min": "OTP must be a 6-digit number",
      "number.max": "OTP must be a 6-digit number",
      "any.required": "OTP is required"
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function verifydpartnerOTP(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp } = req.body;
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    const result :any = await dpartnerObj.verifydpartnerOTP(email, otp);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }
    const token: string | null = generateTokenAndSetCookies(res, result.data.updateResult)
    if (!token) {
      res.send(functionsObj.output(0, "TOKEN_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, result.message, {user:result.data,token}));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function resendOTPSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({
      "string.empty": "Email is required.",
      "string.email": "Invalid email format."
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function resendOTPController(req: Request, res: Response, next: NextFunction) {
  try {
    let { email } = req.body;
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    let result = await dpartnerObj.resendOTP(email);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }
    res.send(functionsObj.output(1, result.message, result.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function loginSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().trim().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().required().trim().replace(/'/g, "").messages({
      "string.empty": "email must be required",
      "string.email": "Invalid email format"
    }),
    password: Joi.string().trim().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().replace(/'/g, "").messages({
      "string.base": "Password must be a string",
      "string.empty": "Password is required",
      "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    
    
    let logindpartner: any = await dpartnerObj.logindpartner(email, password);

    if (logindpartner.error) {
      res.send(functionsObj.output(0, logindpartner.message));
      return;
    }
    let  dpartner=logindpartner.data;

    const token = generateTokenAndSetCookies(res, dpartner.id);
    if (!token) {
      res.send(functionsObj.output(0, "TOKEN_ERROR"));
      return;
    }

    res.send(functionsObj.output(1,logindpartner.message, {dpartner,token}));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    
    let forgotpassword=await dpartnerObj.dpartnerforgotPassword(email);
    if(forgotpassword.error){
      res.send(functionsObj.output(0, forgotpassword.message));
      return;
    }
    
    res.send(functionsObj.output(1, "FORGOT_PASSWORD_SUCCESS", forgotpassword.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function resetPasswordSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email format"
    }),
    password: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim().replace(/'/g, "").messages({
      "string.base": "Password must be a string",
      "string.empty": "Password is required",
      "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
    }),
    confirmpassword: Joi.string().required().valid(Joi.ref("password")).replace(/'/g, "").messages({
      "any.only": "Confirm password must match new password",
      "string.empty": "Confirm password is required"
    })
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    var dpartnerObj = new dbDpartners();
    var functionsObj = new functions();
    const {email, password, confirmpassword ,token} = req.body;
   
    const updateSuccess: any = await dpartnerObj.updatePassword(email, password,token);
    if (updateSuccess.error) {
      res.send(functionsObj.output(0, updateSuccess.message));
      return;
    }

    res.send(functionsObj.output(1, updateSuccess.message, updateSuccess.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

async function getAlldpartners(req: Request, res: Response, next: NextFunction) {
  try {
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    let dpartners = await dpartnerObj.getAlldpartner();
    if (dpartners.error) {
      res.send(functionsObj.output(0, dpartners.message));
      return;
    }
    res.send(functionsObj.output(1, dpartners.message, dpartners.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function updateProfileSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).trim().replace(/'/g, "").messages({
      "string.empty": "name is required"
    }),
    phone: Joi.string().length(10).pattern(/^[0-9]+$/).required().replace(/'/g, "").trim().messages({
      "string.empty": "Phone number is required",
      "string.length": "Phone number must be exactly 10 digits",
      "string.pattern.base": "Phone number must only contain numbers"
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function updatedpartnerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, phone } = req.body;
    const id = req.body.user.id;
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    const result = await dpartnerObj.updatedpartnerProfile(id, name, phone);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }
    res.send(functionsObj.output(1, result.message, result.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

async function getOnedpartner(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.body.user) {
      const functionsObj = new functions();
      res.send(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }

    const dpartnerId = req.body.user.id;
    const dpartnerObj = new dbDpartners();
    const dpartner = await dpartnerObj.finddpartnerById(dpartnerId);
    const functionsObj = new functions();
    if (!dpartner || dpartner.error) {
      res.send(functionsObj.output(0, dpartner.message));
      return;
    }

    res.send(functionsObj.output(1, dpartner.message, dpartner.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function emailSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({
      "string.empty": "Email is required.",
      "string.email": "Invalid email format."
    }),
  });

  const validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function checkEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    var dpartnerObj = new dbDpartners();
    let dpartner = await dpartnerObj.finddpartnerByEmail(email);
    const functionsObj = new functions();
    if (dpartner.error) {
      res.send(functionsObj.output(0, dpartner.message));
      return;
    }

    res.send(functionsObj.output(1, dpartner.message, dpartner.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

async function deletedpartner(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.body.user) {
      const functionsObj = new functions();
      res.status(401).send(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }

    const dpartnerId = req.body.user.id;
    const dpartnerObj = new dbDpartners();
    const result = await dpartnerObj.deletedpartnerProfile(dpartnerId);
    const functionsObj = new functions();
    if (result.error) {
      res.status(404).send(functionsObj.output(0, result.message));
      return;
    }

    res.status(200).send(functionsObj.output(1, result.message, result.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

function AvailabilitySchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    isAvailable: Joi.boolean().required().messages({
      "boolean.base": "Availability must be a boolean value.",
      "any.required": "Availability status is required",
    }),
  });

  const validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

async function dpartnerIsAvailable(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.body.user) {
      const functionsObj = new functions();
      res.status(401).json(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }
    const dpartnerId = req.body.user.id;
    const { isAvailable } = req.body;
    const dpartnerObj = new dbDpartners();
    const updateAvailability: any = await dpartnerObj.setdPartnerAvailable(dpartnerId, isAvailable);
    const functionsObj = new functions();
    if (updateAvailability.error) {
      res.status(400).json(functionsObj.output(0, updateAvailability.message));
      return;
    }

    res.status(200).json(functionsObj.output(1, updateAvailability.message, updateAvailability.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}
