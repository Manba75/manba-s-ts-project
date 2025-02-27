import { functions } from "../library/functions";
import { validations } from "../library/validations";
import { dbcustomers } from "../model/customermodel";
import express, { NextFunction, Request, Response } from "express";
import Joi from "joi";
import requestIp from "request-ip";
import bcrypt from "bcrypt";
import { MailService } from "../library/sendMail";
import { generateTokenAndSetCookies } from "../library/generateTokenAndSetCookies";
import jwt from "jsonwebtoken";
import { dpartnerAuthenticate  } from "../../v1/index";
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
router.put("/update-profile", dpartnerAuthenticate ,updateProfileSchema ,updatedpartnerProfile);
router.post("/check-email", emailSchema, checkEmail);
router.put("/delete-profile/:id", dpartnerAuthenticate, deletedpartner);
router.put( "/isAvailable",dpartnerAuthenticate,AvailabilitySchema,dpartnerIsAvailable);

module.exports = router;

var dpartnerObj = new dbDpartners();
var functionsObj = new functions();
let mailService = new MailService();
var cityObj = new dbCity();
var vehicletypeObj = new dbVehicleType();

// signup schema validation
function signupSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    dpartner_email: Joi.string()
      .trim()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .required()
      .trim()
      .replace(/'/g, "")
      .messages({
        // "email.base": "Invalid the email format",
        "string.empty": "email must be required",
        "string.email": "Invalid email format",
      }),
    dpartner_pass: Joi.string()
      .trim()
      .pattern(
        new RegExp(
          "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$"
        )
      )
      .required()
      .replace(/'/g, "")
      .messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base":
          "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),
    city: Joi.string()
      .min(3)
      .max(50)
      .required()
      .trim()
      .replace(/'/g, "")
      .messages({
        "string.base": "City name should be a string",
        "string.empty": "City name is required",
        "string.min": "City name should be at least 3 characters long",
        "string.max": "City name should not be longer than 50 characters",
      }),
    dpartner_licence: Joi.string()
      .alphanum()
      .min(10)
      .max(15)
      .required()
      .trim()
      .replace(/'/g, "")
      .messages({
        "string.base": "License number should be a string",
        "string.empty": "License number is required",
        "string.alphanum": "License number must be alphanumeric",
        "string.min": "License number should be at least 10 characters long",
        "string.max": "License number should not exceed 15 characters",
      }),
    vehicle_name: Joi.string().trim().replace(/'/g, "").messages({
      "string.empty": "License number is required",
    }),
    vehicletype: Joi.string().messages({
      "string.empty": "vehicle type mustbe required",
    }),
    vehicle_number: Joi.string().trim().replace(/'/g, "").messages({
      "string.empty": "License number is required",
    }),
    dpartner_phone: Joi.string()
      .replace(/'/g, "")
      .trim()
      .length(10)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        "string.empty": "Phone number is required",
        "string.length": "Phone number must be exactly 10 digits",
        "string.pattern.base": "Phone number must only contain numbers",
      }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}
// signup controller
async function signup(req: any, res: any, next: any) {
  try {
    const {
      city, 
      vehicletype, 
      dpartner_email,
      dpartner_pass,
      dpartner_licence,
      dpartner_phone,
      vehicle_number,
      vehicle_name,
    } = req.body;

    const createdip: string | null = requestIp.getClientIp(req) || "";

    
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(dpartner_pass, 10);

    let city_id: any = await cityObj.getCityIdByCityName(city);
 
    if (city_id.error) {
      return res.send(functionsObj.output(0, city_id.message));
    }
    let vehicleType_id: any = await vehicletypeObj.getVehicleTypeIdByName(vehicletype);
   
    if (vehicleType_id.error) {
      return res.send(functionsObj.output(0, vehicleType_id.message));
    }

    let newdpartner: any = await dpartnerObj.insertDpartner(city_id.data, vehicleType_id.data.id, dpartner_email, hashpassword, createdip,dpartner_licence, dpartner_phone, vehicle_number,vehicle_name, otp);
 
    if (newdpartner.error) {
      return res.send(functionsObj.output(0, newdpartner.message));
    } 
     

  await mailService.sendOTPMail(dpartner_email, otp);

  const token: string | null = generateTokenAndSetCookies(res,newdpartner.data.id);
  if (!token) {
    return res.send(functionsObj.output(0, "Generating token error"));
  }

  return res.send(functionsObj.output(1, newdpartner.message, newdpartner.data));
  
  } catch (error: any) {
    console.log("err", error);
    next(error);
  }
}


//verification schema
function verifyOTPSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string().email({minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().trim().required().replace(/'/g, "").messages({"string.empty": "Email is required.","string.email": "Invalid email format.", }),
    
    otp: Joi.number().integer().min(100000).max(999999).required().messages({"number.base": "OTP must be a number","number.min": "OTP must be a 6-digit number","number.max": "OTP must be a 6-digit number","any.required": "OTP is required",}),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// verifyotp controller
async function verifydpartnerOTP(req: any, res: any, next: any) {
  try {
    const { email, otp } = req.body;
    const result = await dpartnerObj.verifydpartnerOTP(email, otp);
    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } 
   return res.send(functionsObj.output(1, result.message, result.data));
    
  } catch (error) {
    console.error("Error in verifydpartnerOTPController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

//resend otp schema
function resendOTPSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string().email({minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().trim().required().replace(/'/g, "").messages({"string.empty": "Email is required.", "string.email": "Invalid email format.", }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// resendOTP controller
async function resendOTPController(req: any, res: any, next: any) {
  try {
    let { email } = req.body;

    let result = await dpartnerObj.resendOTP(email);
    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } 
      
return res.send(functionsObj.output(1, result.message, result.data));
    
  } catch (error) {
    console.error("Error in verifydpartnerOTPController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}


// login schema validation
function loginSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string().trim().email({minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().required().trim().replace(/'/g, "").messages({
        "string.empty": "email must be required",
        "string.email": "Invalid email format",
      }),
    password: Joi.string().trim().pattern(new RegExp( "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().replace(/'/g, "").messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base":"Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),
   
   
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}
async function login(req: any, res: any, next: any) {
  try {
    const { email, password } = req.body;

    const dpartnerResponse: any = await dpartnerObj.finddpartnerByEmail(email);

    if (dpartnerResponse.error) {
      return res.send(functionsObj.output(0, dpartnerResponse.message));
    }

    const dpartner = dpartnerResponse.data;

    const isMatch = await bcrypt.compare(password, dpartner.dpartner_password);
    if (!isMatch) {
      return res.send(functionsObj.output(0, "Email or password does not match")
      );
    }

    if (!dpartner.dpartner_isverify) {
      return res.send(functionsObj.output(0, "Email is not verified"));
    }

    const updateLastLoginResponse: any = await dpartnerObj.updateLastLogin(
      email
    );
    if (updateLastLoginResponse.error) {
      return res.send(functionsObj.output(0, updateLastLoginResponse.message));
    }

    // Generate token
    const token = generateTokenAndSetCookies(res, dpartner.id);
    if (!token) {
      return res.send(functionsObj.output(0, "Error in generating token"));
    }

    return res.send(functionsObj.output(1, dpartner.message, { token, dpartner }));
  } catch (error) {
    console.log("Error:", error);
    next(error);
  }
}

// forgot password
async function forgotPassword(req: any, res: any, next: any) {
  try {
    const { email } = req.body;
    const dpartner: any = await dpartnerObj.finddpartnerByEmail(email);

    if (dpartner.error) {
      return res.send(functionsObj.output(0, dpartner.message));
    }

    
    const resetToken = jwt.sign({ reset: true } as object, process.env.JWT_SECRET as string, {expiresIn: "10m",});

    const resetTokenExpiry = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);

    const updateToken: any = await dpartnerObj.updateResetToken(email,resetToken,resetTokenExpiry);

    if (updateToken.error) {
      return res.send(functionsObj.output(0, updateToken.message));
    }

    const resetLink = `http://localhost:8000/v1/dpartner/reset-password?token=${resetToken}&email=${email}`;

    await mailService.sendResetLink(email, resetLink);

    return res.send(functionsObj.output(1, "Reset link sent to your email.", { resetLink }));
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    next(error);
  }
}

// reset password schema
function resetPasswordSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().trim().required().replace(/'/g, "").messages({
        "string.empty": "Email is required",
        "string.email": "Invalid email format",
      }),

    newPassword: Joi.string().pattern(new RegExp( "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$" ) ).required().trim().replace(/'/g, "") .messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base":
          "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),

    confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")) .replace(/'/g, "") .messages({   "any.only": "Confirm password must match new password",   "string.empty": "Confirm password is required",}),

    resetToken: Joi.string().required().trim().replace(/'/g, "") .messages({ "string.empty": "Token is required", }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}
// reset password
async function resetPassword(req: any, res: any, next: any) {
  try {
    const { email, newPassword, confirmPassword, resetToken } = req.body;

    const dpartner: any = await dpartnerObj.finddpartnerByEmail(email);
    if (dpartner.error || !dpartner.data) {
      return res.send(functionsObj.output(0, dpartner.message));
    }

    const { dpartner_resettoken, dpartner_resettoken_expiry } = dpartner.data;
   
    if (!dpartner_resettoken || resetToken !== dpartner_resettoken) {
      return res.send(functionsObj.output(0, "Invalid or expired token."));
    }

    let expiryTime = new Date(dpartner_resettoken_expiry + " UTC");
     const currentTime = new Date();
    if (currentTime > expiryTime) {
      return res.send(functionsObj.output(0, "Token has expired."));
    }

    
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateSuccess: any = await dpartnerObj.updatePassword( email, hashedPassword );
    if (updateSuccess.error) {
      return res.send(functionsObj.output(0, updateSuccess.message));
    } 
    return res.send(functionsObj.output(1, updateSuccess.message, updateSuccess.data));
    
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return next(error);
  }
}

//get all dpartner
async function getAlldpartners(req: any, res: any, next: any) {
  try {
    let dpartners = await dpartnerObj.getAlldpartner();
   
    if (dpartners.error) {
      return res.send(functionsObj.output(0, dpartners.message));
    } else {
      return res.send(functionsObj.output(1, dpartners.message, dpartners.data));
    }
  } catch (error) {
    console.error("Error in fetched dpartner:", error);
    return next(error);
  }
}

// updateprofile schema

function updateProfileSchema(req: Request, res: any, next: any) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).trim().replace(/'/g, "").messages({
      "string.empty": "name is required",
    }),
    phone: Joi.string().length(10).pattern(/^[0-9]+$/).required().replace(/'/g, "").trim().messages({
        "string.empty": "Phone number is required",
        "string.length": "Phone number must be exactly 10 digits",
        "string.pattern.base": "Phone number must only contain numbers",
      }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

//update-profile
async function updatedpartnerProfile(req: any, res: any, next: any) {
  try {
    const { name, phone } = req.body;
    const id = req.body.user.id; 
    const result = await dpartnerObj.updatedpartnerProfile(id, name, phone);

    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } 
   return res.send(functionsObj.output(1, result.message, result.data));
  
  } catch (error) {
    console.error("Error in updatedpartnerProfileController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// get one dpartner profile
async function getOnedpartner(req: any, res: any, next: NextFunction) {
  try {
    if (!req.body.user) {
      return res.send(functionsObj.output(0, "Unauthorized: No dpartner data found"));
    }

    const dpartnerId = req.body.user.id;
    const dpartner = await dpartnerObj.finddpartnerById(dpartnerId);
    if (!dpartner || dpartner.error) {
      return res.send(functionsObj.output(0, dpartner?.message || "dpartner not found") );
    }

    return res.send(functionsObj.output(1, dpartner.message, dpartner.data));
  } catch (error) {
    console.error("Error fetching dpartner:", error);
    return next(error);
  }
}

// email schema
function emailSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().trim().required().replace(/'/g, "").messages({ "string.empty": "Email is required.","string.email": "Invalid email format.", }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

//check email
async function checkEmail(req: any, res: any, next: any) {
  try {
    const { email } = req.body;


    const dpartner = await dpartnerObj.finddpartnerByEmail(email);

    if (!dpartner || dpartner.error) {
      return res.status(404).send(functionsObj.output(0, dpartner.message));
    }

  
    return res.status(200).send(functionsObj.output( 1, dpartner.message, dpartner.data));
  } catch (error) {
    console.error("Error checking email:", error);
    return next(error);
  }
}

//delete -profile

async function deletedpartner(req: any, res: any, next: any) {
  try {
    if (!req.body.user) {
      return res.status(401).send(functionsObj.output(0, "Unauthorized: No dpartner data found"));
    }

    const dpartnerId = req.body.user.id;
    const result = await dpartnerObj.deletedpartnerProfile(dpartnerId);

    if (result.error) {
      return res.status(404).send(functionsObj.output(0, result.message));
    }

    return res.status(200).send(functionsObj.output(1, result.message, result.data));
  } catch (error) {
    console.error("Error deleting dpartner:", error);
    return next(error);
  }
}


// update delivery partner schema
function AvailabilitySchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    isAvailable: Joi.boolean().required().messages({
      "boolean.base": "Availability must be a boolean value.",
      "any.required": "Availability status is required",
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}


//update delivery partner status
 async function dpartnerIsAvailable (req: any, res: any, next: any){
  try {
   
    if (!req.body.user) {
      return res.status(401).json( functionsObj.output(0, "Unauthorized: No delivery partner data found"));
    }
    const dpartnerId = req.body.user.id;
    const { isAvailable } = req.body;

    const updateAvailability:any = await dpartnerObj.setdPartnerAvailable(dpartnerId, isAvailable);

    if (updateAvailability.error) {
      return res.status(400).json(functionsObj.output(0, updateAvailability.message));
    }

    return res.status(200).json(functionsObj.output( 1, "Successfully updated the availability of the delivery partner",updateAvailability.data));
  } catch (error) {
    console.error("Error updating delivery partner availability:", error);
    return next(error);
  }
};


