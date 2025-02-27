import express, { NextFunction, Request, Response ,RequestHandler} from "express";
import Joi from "joi";
import { functions } from "../library/functions";
import { validations } from "../library/validations";
import { dbcustomers } from "../model/customermodel";
import requestIp from "request-ip";
import bcrypt from "bcrypt";
import { MailService } from "../library/sendMail";
import { generateTokenAndSetCookies } from "../library/generateTokenAndSetCookies";
import jwt from "jsonwebtoken";
import { authenticateCustomer } from "../../v1/index";
import { generateOTP } from "../library/generateOTP";
import { CustomRequestHandler } from "../types/CustomRequestHandler";
import { CustomResponseHandler } from "../types/CustomResponseHandler";
const router = express.Router();

router.post("/signup", signupSchema, signup);
router.post("/verify-otp", verifyOTPSchema, verifyUserOTP);
router.post("/resend-otp", resendOTPSchema, resendOTPController);
router.post("/login", signupSchema, login);
router.post("/forgot-password", emailSchema, forgotPassword);
router.post("/reset-password", resetPasswordSchema, resetPassword);
router.get("/get-users", getAllUsers);
router.get("/get-profile/:id", authenticateCustomer, getOneUser);
router.put( "/update-profile",authenticateCustomer,updateProfileSchema,updateUserProfile);
router.post("/check-email", emailSchema, checkEmail);
router.put("/delete-profile/:id", authenticateCustomer, deleteUser);

module.exports = router;

let customersObj = new dbcustomers();

// signup schema validation
function signupSchema(req: Request, res: Response, next : NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2,tlds: { allow: ["com","net"] },}) .lowercase() .trim().required().replace(/'/g, "")
    .messages({"string.empty": "Email is required.","string.email": "Invalid email format.",}),
    password: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim()
     .messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base":
          "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}
// signup controller
async function signup (req: Request, res: Response, next : NextFunction) {
  try {
    
    const { email, password } = req.body;
    const createdip: string | null = requestIp.getClientIp(req) || "";

    
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(password, 10);

    let newUser = await customersObj.createCustomer( email,hashpassword,otp,createdip);
  
    var functionsObj = new functions();
    if (newUser.error) {
       res.send(functionsObj.output(0, newUser.message));
       return;
      
    } 
      
    let mailService = new MailService();
    await mailService.sendOTPMail(email, otp);

    const token: string | null = generateTokenAndSetCookies(res,newUser.data.id);
    if (!token) {
     res.send(functionsObj.output(0, "Generating token error"));
     return ;
    }
    
     res.send(functionsObj.output(1, newUser.message, newUser.data));
     return;
  
    
  } catch (error: any) {
    console.log("err", error);
      res.send(next(error));
      return;
  }
}

// verifyOTP schema
function verifyOTPSchema(req: Request,  res: Response, next : NextFunction) {
  const schema = Joi.object({
    email: Joi.string() .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } }).lowercase().trim().required()  .replace(/'/g, "")
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Invalid email format.",
      }),
    otp: Joi.number().integer().min(100000).max(999999).required().messages({
      "number.base": "OTP must be a number",
      "number.min": "OTP must be a 6-digit number",
      "number.max": "OTP must be a 6-digit number",
      "any.required": "OTP is required",
    }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// verifyotp controller
async function verifyUserOTP(req: Request, res: Response, next : NextFunction) {
  var functionsObj = new functions();
  try {
    const { email, otp } = req.body;
    const result = await customersObj.verifyUserOTP(email, otp);
   
    if (result.error) {
       res.send(functionsObj.output(0, result.message));
       return;
    } else {
       res.send(functionsObj.output(1, result.message, result.data));
       return;
    }
  } catch (error) {
    console.error("Error in verifyUserOTPController:", error);
     res.send(functionsObj.output(0, "Internal server error", error));
     return;
  }
}

//resend otp schema
function resendOTPSchema(req: Request,  res: Response, next : NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2,tlds: { allow: ["com",
      "net"] },}).lowercase().trim().required().replace(/'/g, "").messages({"string.empty": "Email is required.","string.email": "Invalid email format.",}),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// resendOTP controller
async function resendOTPController(req: Request,  res: Response, next : NextFunction) {
  var functionsObj = new functions();
  try {
    let { email } = req.body;

    let result = await customersObj.resendOTP(email);
    if (result.error) {
       res.send(functionsObj.output(0, result.message));
       return;
    } else {
       res.send(functionsObj.output(1, result.message, result.data));
       return;
    }
  } catch (error) {
    console.error("Error in verifyUserOTPController:", error);
     res.send(functionsObj.output(0, "Internal server error", error));
     return;
  }
}

// login schema

async function login(req: Request,  res: Response, next : NextFunction) {
  var functionsObj = new functions();
  try {

    const { email, password, socketId } = req.body;

    const userResponse: any = await customersObj.findUserByEmail(email);

    if (userResponse.error) {
     res.send(functionsObj.output(0, userResponse.message));
     return;
    }

    const user = userResponse.data;

    const isMatch = await bcrypt.compare(password, user.cust_password);
    if (!isMatch) {
       res.send(functionsObj.output(0, "Email or password does not match"));
       return;
    }
    if (!user.cust_isverify) {
     res.send(functionsObj.output(0, "Email is not verified"));
     return;
    }

    const updateLastLoginResponse: any = await customersObj.updateLastLogin( email);
    if (updateLastLoginResponse.error) {
     res.send(functionsObj.output(0, updateLastLoginResponse.message));
     return;
    }

    let updatesocketid: any = await customersObj.updateSocketId( user.id, socketId);
    if (updatesocketid.error) {
     res.send(functionsObj.output(0, "Error in generating socketid"));
     return;
    }
    const token = generateTokenAndSetCookies(res, user.id);
    if (!token) {
     res.send(functionsObj.output(0, "Error in generating token"));
     return;
    }

    let Socketid = updatesocketid.data;

   res.send(functionsObj.output(1, user.message, { token, user, Socketid }));
  } catch (error) {
    console.log("Error:", error);
    next(error);
    return;
  }
}

// forgot password
async function forgotPassword(req: Request,  res: Response, next : NextFunction) {
  var functionsObj = new functions();
  try {
    const { email } = req.body;
    const user= await customersObj.findUserByEmail(email);

    if (user.error) {
     res.send(functionsObj.output(0, user.message));
     return;
    }

    const resetToken = jwt.sign({ reset: true } as object, process.env.JWT_SECRET as string,  {expiresIn: "10m",});

    const resetTokenExpiry = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);

    const updateToken: any = await customersObj.updateResetToken(email,resetToken,resetTokenExpiry);

    if (updateToken.error) {
     res.send(functionsObj.output(0, updateToken.message));
     return;
    }

    const resetLink = `http://localhost:8000/v1/customer/reset-password?token=${resetToken}&email=${email}`;
    let mailService = new MailService();
    await mailService.sendResetLink(email, resetLink);

   res.send(functionsObj.output(1, "Reset link sent to your email.", { resetLink }) );
   return;
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    next(error);
    return;
  }
}

// reset password schema
function resetPasswordSchema(req: Request,  res: Response, next : NextFunction) {
  const schema = Joi.object({

    email: Joi.string().email({minDomainSegments: 2,tlds: { allow: ["com", "net"] },}).lowercase().trim() .required().replace(/'/g, "").messages({"string.empty": "Email is required","string.email": "Invalid email format",}),
    newPassword: Joi.string().pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$")).required().trim().replace(/'/g, "").messages({"string.base": "Password must be a string","string.empty": "Password is required","string.pattern.base":"Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",}),
    confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")) .trim().replace(/'/g, "") .messages({"any.only": "Confirm password must match new password","string.empty": "Confirm password is required",}),
    resetToken: Joi.string().required().trim().replace(/'/g, "") .messages({"string.empty": "Token is required",}),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
  ;
  }

  next();
}
// reset password
async function resetPassword(req: Request,  res: Response, next : NextFunction) {
  try {
    const { email, newPassword, confirmPassword, resetToken } = req.body;
    var functionsObj = new functions();
    const user = await customersObj.findUserByEmail(email);
    if (user.error || !user.data) {
     res.send(functionsObj.output(0, user.message));
     return;
    }

    const { cust_resettoken, cust_resettoken_expiry } = user.data;

    if (!cust_resettoken || resetToken !== cust_resettoken) {
     res.send(functionsObj.output(0, "Invalid or expired token."));
     return;
    }

    let expiryTime = new Date(cust_resettoken_expiry + " UTC");
    const currentTime = new Date();
    if (currentTime > expiryTime) {
     res.send(functionsObj.output(0, "Token has expired."));
     return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);


    const updateSuccess: any = await customersObj.updatePassword(email,hashedPassword);
    if (updateSuccess.error) {
     res.send(functionsObj.output(0, updateSuccess.message));
     return;
    } 
     res.send(functionsObj.output(1, updateSuccess.message, updateSuccess.data) );
     return;
  } catch (error) {
    console.error("Error in resetPassword:", error);
   next(error);
   return;
  }
}

//get all user
async function getAllUsers(req: Request,  res: Response, next : NextFunction) {
  try {
    var functionsObj = new functions();
    let users = await customersObj.getAllUser();
    if (users.error) {
     res.send(functionsObj.output(0, users.message));
     return;
    } 
     res.send(functionsObj.output(1, users.message, users.data));
     return;
    
  } catch (error) {
    console.error("Error in fetched user:", error);
   next(error);
   return;
  }
}

// updateprofile schema

function updateProfileSchema(req: Request,  res: Response, next : NextFunction) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).trim().replace(/'/g, "").messages({"string.empty": "name is required",}),
    phone: Joi.string().length(10).pattern(/^[0-9]+$/).required() .replace(/'/g, "").trim().messages({"string.empty": "Phone number is required","string.length": "Phone number must be exactly 10 digits","string.pattern.base": "Phone number must only contain numbers", }),
  });

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}


//update-profile
async function updateUserProfile(req:Request,  res: Response, next : NextFunction) {
  var functionsObj = new functions();
  try {
    const { name, phone } = req.body;
    const id = req.body.user.id; 
   
    const result = await customersObj.updateUserProfile(id, name, phone);
    if (result.error) {
     res.send(functionsObj.output(0, result.message));
     return;
    } 
   res.send(functionsObj.output(1, result.message, result.data));
   return;
    
  } catch (error) {
    console.error("Error in updateUserProfileController:", error);
   res.send(functionsObj.output(0, "Internal server error", error));
   return;
  }
}

// get one user profile
async function getOneUser(req: CustomRequestHandler,  res: Response, next : NextFunction) {
  try {
    var functionsObj = new functions();
    if (!req.body.user) {
       res.send(functionsObj.output(0, "Unauthorized: No user data found") );
       return;
    }

    const userId = req.body.user.id;
    const user = await customersObj.findUserById(userId);

    if (!user || user.error) {
       res.send(functionsObj.output(0, user?.message || "User not found"));
       return;
      
    }
     res.send(functionsObj.output(1, user.message, user.data));
     return;
  } catch (error) {
    console.error("Error fetching user:", error);
     next(error);
     return;
  }
}

// email schema
function emailSchema(req: Request,  res: Response, next : NextFunction) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] }, }).lowercase().trim() .required().replace(/'/g, "").messages({"string.empty": "Email is required.","string.email": "Invalid email format.", }),});

  let validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

//check email
async function checkEmail(req: Request,  res: Response, next : NextFunction) {
  try {
    const { email } = req.body;

    const user = await customersObj.findUserByEmail(email);
    var functionsObj = new functions();
    if (!user || user.error) {
      
      res.send(functionsObj.output(0, "Email not registered. Please sign up."));
      return;
    }

    
    res.send(functionsObj.output(1,"Email is already registered. Please log in to continue.",user.data));
    return;
  } catch (error) {
    console.error("Error checking email:", error);
    
    next(error);
    return;
  }
}

//delete -profile

async function deleteUser(req:any,  res: Response, next : NextFunction) {
  try {
    var functionsObj = new functions();
    if (!req.body.user) {
      res.send(functionsObj.output(0, "Unauthorized: No user data found"));  
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
    console.error("Error deleting user:", error);
    next(error);
    return;
  }
}
