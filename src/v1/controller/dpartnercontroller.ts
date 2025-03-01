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
router.post("/verify-otp", verifyOTPSchema, verifydpartnerOTP);
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
    dpartner_phone: Joi.string().replace(/'/g, "").trim().length(10).pattern(/^[0-9]+$/).required().messages({
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
    const createdip: string | null = requestIp.getClientIp(req) || "";
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(dpartner_pass, 10);
    let cityObj = new dbCity();
    let vehicletypeObj = new dbVehicleType();
    let dpartnerObj = new dbDpartners();
    let functionsObj = new functions();
    let mailService = new MailService();

    let city_id: any = await cityObj.getCityIdByCityName(city);
    if (city_id.error) {
      res.send(functionsObj.output(0, "CITY_NOT_FOUND"));
      return;
    }

    let vehicleType_id: any = await vehicletypeObj.getVehicleTypeIdByName(vehicletype);
    if (vehicleType_id.error) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    let newdpartner: any = await dpartnerObj.insertDpartner(city_id.data, vehicleType_id.data.id, dpartner_email, hashpassword, createdip, dpartner_licence, dpartner_phone, vehicle_number, vehicle_name, otp);
    if (newdpartner.error) {
      res.send(functionsObj.output(0, "DPARTNER_INSERT_ERROR"));
      return;
    }

    await mailService.sendOTPMail(dpartner_email, otp);
    const token: string | null = generateTokenAndSetCookies(res, newdpartner.data.id);
    if (!token) {
      res.send(functionsObj.output(0, "TOKEN_ERROR"));
      return;
    }

    res.send(functionsObj.output(1, "DPARTNER_INSERT_SUCCESS", newdpartner.data));
    return;
  } catch (error: any) {
    next(error);
    return;
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
    const result = await dpartnerObj.verifydpartnerOTP(email, otp);
    if (result.error) {
      res.send(functionsObj.output(0, "OTP_VERIFY_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, "USER_VERIFIED_SUCCESS", result.data));
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
      res.send(functionsObj.output(0, "OTP_RESEND_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, "OTP_RESEND_SUCCESS", result.data));
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
    const dpartnerResponse: any = await dpartnerObj.finddpartnerByEmail(email);
    if (dpartnerResponse.error) {
      res.send(functionsObj.output(0, dpartnerResponse.message));
      return;
    }

    const dpartner = dpartnerResponse.data;
    const isMatch = await bcrypt.compare(password, dpartner.dpartner_password);
    if (!isMatch) {
      res.send(functionsObj.output(0, "EMAIL_PASSWORD_MATCH_ERROR"));
      return;
    }

    if (!dpartner.dpartner_isverify) {
      res.send(functionsObj.output(0, "EMAIL_VERIFIED_FAIL"));
      return;
    }

    const updateLastLoginResponse: any = await dpartnerObj.updateLastLogin(email);
    if (updateLastLoginResponse.error) {
      res.send(functionsObj.output(0, "DPARTNERS_LOGIN_FAIL"));
      return;
    }

    const token = generateTokenAndSetCookies(res, dpartner.id);
    if (!token) {
      res.send(functionsObj.output(0, "TOKEN_ERROR"));
      return;
    }

    res.send(functionsObj.output(1,"DPARTNERS_LOGIN_SUCCESS", { token, dpartner }));
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
    let mailService = new MailService();
    const dpartner: any = await dpartnerObj.finddpartnerByEmail(email);
    if (dpartner.error) {
      res.send(functionsObj.output(0, dpartner.message));
      return;
    }

    const resetToken = jwt.sign({ reset: true } as object, process.env.JWT_SECRET as string, { expiresIn: "10m" });
    const resetTokenExpiry = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);
    const updateToken: any = await dpartnerObj.updateResetToken(email, resetToken, resetTokenExpiry);
    if (updateToken.error) {
      res.send(functionsObj.output(0, "FORGOT_PASSWORD_ERROR"));
      return;
    }

    const resetLink = `http://localhost:8000/v1/dpartner/reset-password?token=${resetToken}&email=${email}`;
    await mailService.sendResetLink(email, resetLink);
    res.send(functionsObj.output(1, "FORGOT_PASSWORD_SUCCESS", { resetLink }));
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
    newPassword: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim().replace(/'/g, "").messages({
      "string.base": "Password must be a string",
      "string.empty": "Password is required",
      "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")).replace(/'/g, "").messages({
      "any.only": "Confirm password must match new password",
      "string.empty": "Confirm password is required"
    }),
    resetToken: Joi.string().required().trim().replace(/'/g, "").messages({
      "string.empty": "Token is required"
    }),
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
    const { email, newPassword, confirmPassword, resetToken } = req.body;

    const dpartner: any = await dpartnerObj.finddpartnerByEmail(email);
    if (dpartner.error || !dpartner.data) {
      res.send(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }

    const { dpartner_resettoken, dpartner_resettoken_expiry } = dpartner.data;
    if (!dpartner_resettoken || resetToken !== dpartner_resettoken) {
      res.send(functionsObj.output(0, "Invalid or expired token."));
      return;
    }

    let expiryTime = new Date(dpartner_resettoken_expiry + " UTC");
    const currentTime = new Date();
    if (currentTime > expiryTime) {
      res.send(functionsObj.output(0, "Token has expired."));
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateSuccess: any = await dpartnerObj.updatePassword(email, hashedPassword);
    if (updateSuccess.error) {
      res.send(functionsObj.output(0, "RESET_PASSWORD_ERROR"));
      return;
    }

    res.send(functionsObj.output(1, "RESET_PASSWORD_SUCCESS", updateSuccess.data));
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
      res.send(functionsObj.output(0, "DPARTNERS_FETCH_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, "DPARTNERS_FETCH_SUCCESS", dpartners.data));
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
      res.send(functionsObj.output(0, "DPARTNER_UPDATE_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, "DPARTNER_UPDATE_SUCCESS", result.data));
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
      res.send(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "DPARTNER_FETCH_SUCCESS", dpartner.data));
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
    const dpartner = await dpartnerObj.finddpartnerByEmail(email);
    const functionsObj = new functions();
    if (!dpartner || dpartner.error) {
      res.status(404).send(functionsObj.output(0, "DPARTNER_NOT_FOUND"));
      return;
    }

    res.status(200).send(functionsObj.output(1, "DPARTNER_EXISTS", dpartner.data));
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
      res.status(404).send(functionsObj.output(0, "DPARTNER_DELETE_ERROR"));
      return;
    }

    res.status(200).send(functionsObj.output(1, "DPARTNER_DELETE_SUCCESS", result.data));
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
      res.status(400).json(functionsObj.output(0, "DPARTNER_UPDATE_AVAILABLE_ERROR "));
      return;
    }

    res.status(200).json(functionsObj.output(1, "DPARTNER_UPDATE_AVAILABLE_SUCCESS ", updateAvailability.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}
