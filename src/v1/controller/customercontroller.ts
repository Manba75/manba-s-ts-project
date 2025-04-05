import express, { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { functions } from '../library/functions';
import { validations } from "../library/validations";
import { dbcustomers } from "../model/customermodel";
import requestIp from "request-ip";
import bcrypt from "bcrypt";
import { MailService } from "../library/sendMail";
import { generateTokenAndSetCookies } from "../library/generateTokenAndSetCookies";
import jwt from "jsonwebtoken";
import { authenticateCustomer } from "../../v1/index";
import { generateOTP } from "../library/generateOTP";
const router = express.Router();

router.post("/signup", signupSchema, signup);
router.post("/verify-otp",verifyOTPSchema, verifyUserOTP);
router.post("/resend-otp", resendOTPSchema, resendOTPController);
router.post("/login", loginSchema, login);
router.post("/forgot-password", emailSchema, forgotPassword);
router.post("/reset-password", resetPasswordSchema, resetPassword);
router.get("/get-users", getAllUsers);
router.get("/get-profile", authenticateCustomer, getOneUser);
router.put("/update-profile", authenticateCustomer, updateProfileSchema, updateUserProfile);
router.post("/check-email", emailSchema, checkEmail);
router.put("/delete-profile/:id", authenticateCustomer, deleteUser);
router.get("/customer-get-by-id", authenticateCustomer, getCustomerById);

module.exports = router;

let customersObj = new dbcustomers();


// signup schema
function signupSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({ "string.empty": "Email is required.", "string.email": "Invalid email format." }),
    password: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim().messages({ "string.base": "Password must be a string", "string.empty": "Password is required", "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character." }),
    confirmpassword:Joi.string().required().valid(Joi.ref("password")).trim().replace(/'/g, "").messages({ "any.only": "Confirm password must match password", "string.empty": "Confirm password is required" }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// signup

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password ,confirmpassword} = req.body;
    const createdip: string | null = requestIp.getClientIp(req) || "";
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(password, 10);
    let newUser = await customersObj.createCustomer(email, hashpassword, otp, createdip);
    var functionsObj = new functions();
    if (newUser.error) {
      res.send(functionsObj.output(0, newUser.message));
      return;
    }
    let mailService = new MailService();
    await mailService.sendOTPMail(email, otp);
     
   
    res.send(functionsObj.output(1, newUser.message, newUser.data));
    return;
  } catch (error: any) {
    res.send(next(error));
    return;
  }
}

// verify otp schema
function verifyOTPSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    otp: Joi.number().integer().min(100000).max(999999).required().messages({ "number.base": "OTP must be a number", "number.min": "OTP must be a 6-digit number", "number.max": "OTP must be a 6-digit number", "any.required": "OTP is required" }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}


// verify otp
async function verifyUserOTP(req: Request, res: Response, next: NextFunction) {
  var functionsObj = new functions();
  try {
    const { email, otp } = req.body;
    const result :any= await customersObj.verifyUserOTP(email, otp);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }
    
    const token: string | null = generateTokenAndSetCookies(res, result.data.user.id);
    if (!token) {
      res.send(functionsObj.output(0, "TOKEN_ERROR"));
      return;
    }
    res.send(functionsObj.output(1, result.message, {user:result.data.user,token}));
    return;
  } catch (error) {
    res.send(functionsObj.output(0, "USER_VERIFIED_ERROR ", error));
    return;
  }
}

// resend otp schema
function resendOTPSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({ "string.empty": "Email is required.", "string.email": "Invalid email format." }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// resend otp
async function resendOTPController(req: Request, res: Response, next: NextFunction) {
  var functionsObj = new functions();
  try {
    let { email } = req.body;
    let result = await customersObj.resendOTP(email);
    if (result.error) {
      res.send(functionsObj.output(0, result.message));
      return;
    }
    res.send(functionsObj.output(1, result.message, result.data));
    return;
  } catch (error:any) {
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}


//login schema
function loginSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string()
      .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
      .lowercase()
      .trim()
      .required()
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Invalid email format.",
      }),

    password: Joi.string()
      .pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$"))
      .required()
      .trim()
      .messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),

    // latitude: Joi.string().required().messages({ "any.required": "Latitude is required." }),
    // longitude: Joi.string().required().messages({ "any.required": "Longitude is required." }),
    city: Joi.string().required().messages({ "any.required": "City is required." }).optional(),

    flatno: Joi.string().optional(),
    street: Joi.string().optional(),
    landmark: Joi.string().optional(),
    pincode: Joi.string().pattern(/^\d{5,6}$/).optional().messages({
      "string.pattern.base": "Zip code must be 5-6 digits.",
    }),
    phone: Joi.string().length(10).pattern(/^[0-9]+$/).optional().messages({
      "string.length": "Phone number must be exactly 10 digits",   })
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// login
async function login(req: Request, res: Response, next: NextFunction) {
  var functionsObj = new functions();
  try {
      const { email, password, socketid, latitude, longitude, city ,street,flatno,landmark,pincode} = req.body;
      let loginuser = await customersObj.loginUser(email, password, latitude, longitude, city,street,flatno,landmark,pincode);
      
      if (loginuser.error) {
          res.send(functionsObj.output(0, loginuser.message));
          return;
      }

      let user = loginuser.data.user;
      let address = loginuser.data.address; 

      const token = generateTokenAndSetCookies(res, user.id);
      if (!token) {
          res.send(functionsObj.output(0, "TOKEN_ERROR"));
          return;
      }

      res.send(functionsObj.output(1, loginuser.message, { user, token, address }));
      return;
  } catch (error) {
      next(error);
      return;
  }
}


//forgotpassword 
async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  var functionsObj = new functions();
  try {
    const { email } = req.body;
    let forgotpassword= await customersObj.customerforgotPassword(email);
    if(forgotpassword.error){
      res.send(functionsObj.output(0, forgotpassword.message));
      return;
    }
   
    res.send(functionsObj.output(1, forgotpassword.message,forgotpassword.data ));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

// resetpassword schema
function resetPasswordSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({ "string.empty": "Email is required", "string.email": "Invalid email format" }),
    password: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim().replace(/'/g, "").messages({ "string.base": "Password must be a string", "string.empty": "Password is required", "string.pattern.base": "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character." }),
    confirmpassword: Joi.string().required().valid(Joi.ref("password")).trim().replace(/'/g, "").messages({ "any.only": "Confirm password must match new password", "string.empty": "Confirm password is required" }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// resetpassword
async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
      const {email, password ,confirmpassword,token} = req.body;
     
      const functionsObj = new functions();
  
      let result = await customersObj.updatePassword(email, password, token);

      if (result.error) {
          res.status(400).send(functionsObj.output(0, result.message));
          return
      }

      res.status(200).send(functionsObj.output(1, result.message, result.data));
      return;
  } catch (error) {
      next(error);
      return;
  }
}

// get all users
async function getAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    var functionsObj = new functions();
    let users = await customersObj.getAllUser();
    if (users.error) {
      res.send(functionsObj.output(0, users.message));
      return;
    }
    res.send(functionsObj.output(1,users.message, users.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}


// updateschema
function updateProfileSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    cust_name: Joi.string().min(2).max(50).trim().replace(/'/g, "").messages({ "string.empty": "name is required" }),
    cust_phone: Joi.string().length(10).pattern(/^[0-9]+$/).required().replace(/'/g, "").trim().messages({ "string.empty": "Phone number is required", "string.length": "Phone number must be exactly 10 digits", "string.pattern.base": "Phone number must only contain numbers" }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// update user profile
async function updateUserProfile(req: Request, res: Response, next: NextFunction) {
  var functionsObj = new functions();
  try {
      const { cust_name, cust_phone,  street, flatno, landmark, city_name, pincode, latitude, longitude } = req.body;
      const id = req.body.user.id;
      
      const result = await customersObj.updateUserprofile(id, cust_name, cust_phone, street, flatno, landmark, city_name, pincode, latitude, longitude);
      
      if (result.error) {
          res.send(functionsObj.output(0, result.message));
          return;
      }
      
      res.send(functionsObj.output(1, result.message, result.data));
      return;
  } catch (error) {
      res.send(functionsObj.output(0, "CUSTOMER_UPDATE_ERROR", error));
      return;
  }
}

// getuser profile
async function getOneUser(req: Request, res: Response, next: NextFunction) {
  try {
    var functionsObj = new functions();
    if (!req.body.user) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND "));
      return;
    }
    const userId = req.body.user.id;
    const user = await customersObj.getUserProfile(userId);
    if (!user || user.error) {
      res.send(functionsObj.output(0, user.message));
      return;
    }
    res.send(functionsObj.output(1, user.message, user.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

// email schema
function emailSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required().replace(/'/g, "").messages({ "string.empty": "Email is required.", "string.email": "Invalid email format." }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// check email
async function checkEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    let user:any = await customersObj.findUserByEmail(email);
    var functionsObj = new functions();
    if (user.error ) {
      res.send(functionsObj.output(0, user.message));
      return;
    }
   

    res.send(functionsObj.output(1, user.message, user.data));
    return;
  } catch (error) {
    next(error);
    return;
  }
}

// delete user
async function deleteUser(req: any, res: Response, next: NextFunction) {
  try {
    var functionsObj = new functions();
    if (!req.body.user) {
      res.send(functionsObj.output(0, "CUSTOMER_NOT_FOUND"));
      return;
    }
    const userId = req.body.user.id;
    const result = await customersObj.deleteUserProfile(userId);
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

//get customer by id 
async function getCustomerById(req: Request, res: Response, next: NextFunction) {
  try {
    var functionsObj = new functions();
    const {id} = req.body
    const customer = await customersObj.findUserById(id);
    if (customer.error) {
      res.status(404).send(functionsObj.output(0, customer.message));
      return;
    }
    res.status(200).send(functionsObj.output(1, customer.message, customer.data))
  } catch (error) {
    next(error);
  }
}