import express, { NextFunction, Request, Response } from "express";
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
const router = express.Router();

router.post("/signup", signupSchema, signup);
router.post("/verify-otp", verifyOTPSchema, verifyUserOTP);
router.post("/resend-otp", resendOTPSchema, resendOTPController);
router.post("/login", signupSchema, login);
router.post("/forgot-password", emailSchema, forgotPassword);
router.post("/reset-password", resetPasswordSchema, resetPassword);
router.get("/get-users", getAllUsers);
router.get("/get-profile/:id", authenticateCustomer, getOneUser);
router.put(
  "/update-profile",
  authenticateCustomer,
  updateProfileSchema,
  updateUserProfile
);
router.post("/check-email", emailSchema, checkEmail);
router.put("/delete-profile/:id", authenticateCustomer, deleteUser);

module.exports = router;

let customersObj = new dbcustomers();
var functionsObj = new functions();
let mailService = new MailService();

// signup schema validation
function signupSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .trim()
      .required()
      .replace(/ /g, "")
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Invalid email format.",
      }),
    password: Joi.string()
      .pattern(
        new RegExp(
          "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$"
        )
      )
      .required()
      .trim()
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
async function signup(req: any, res: any, next: any) {
  try {
    const { email, password } = req.body;
    const createdip: string | null = requestIp.getClientIp(req) || "";

    // Generate OTP
    const generateOTP = require("../library/generateOTP");
    const otp: number = generateOTP();
    const hashpassword: string = await bcrypt.hash(password, 10);

    let newUser: any = await customersObj.createCustomer(
      email,
      hashpassword,
      otp,
      createdip
    );
    // console.log("nw",newUser.data)

    if (newUser.error) {
      return res.send(functionsObj.output(0, newUser.message));
    } else {
      // Send OTP email

      await mailService.sendOTPMail(email, otp);

      const token: string | null = generateTokenAndSetCookies(
        res,
        newUser.data.id
      );
      if (!token) {
        return res.send(functionsObj.output(0, "Generating token error"));
      }

      return res.send(functionsObj.output(1, newUser.message, newUser.data));
    }
  } catch (error: any) {
    console.log("err", error);
    next(error);
  }
}

// verifyOTP schema
function verifyOTPSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .trim()
      .required()
      .replace(/ /g, "")
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
async function verifyUserOTP(req: any, res: any, next: any) {
  try {
    const { email, otp } = req.body;

    // Call the verifyUserOTP function from dbcustomers model
    const result = await customersObj.verifyUserOTP(email, otp);

    // Send response
    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } else {
      return res.send(functionsObj.output(1, result.message, result.data));
    }
  } catch (error) {
    console.error("Error in verifyUserOTPController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

//resend otp schema
function resendOTPSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .trim()
      .required()
      .replace(/ /g, "")
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Invalid email format.",
      }),
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

    let result = await customersObj.resendOTP(email);
    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } else {
      return res.send(functionsObj.output(1, result.message, result.data));
    }
  } catch (error) {
    console.error("Error in verifyUserOTPController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// login schema

async function login(req: any, res: any, next: any) {
  try {
    // Validate input

    const { email, password ,socketId} = req.body;

    // Find user by email
    const userResponse: any = await customersObj.findUserByEmail(email);

    if (userResponse.error) {
      return res.send(functionsObj.output(0, userResponse.message));
    }

    const user = userResponse.data;

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.cust_password);
    if (!isMatch) {
      return res.send(
        functionsObj.output(0, "Email or password does not match")
      );
    }

    // Check email verification
    if (!user.cust_isverify) {
      return res.send(functionsObj.output(0, "Email is not verified"));
    }

    // Update last login
    const updateLastLoginResponse: any = await customersObj.updateLastLogin(
      email
    );
    if (updateLastLoginResponse.error) {
      return res.send(functionsObj.output(0, updateLastLoginResponse.message));
    }

     let updatesocketid :any=  await customersObj.updateSocketId(user.id, socketId);
     if(updatesocketid.error){
      return res.send(functionsObj.output(0, "Error in generating socketid"));
     }
    // Generate token
    const token = generateTokenAndSetCookies(res, user.id);
    if (!token) {
      return res.send(functionsObj.output(0, "Error in generating token"));
    }
    let Socketid = updatesocketid.data;

    return res.send(functionsObj.output(1, user.message, { token, user, Socketid}));
  } catch (error) {
    console.log("Error:", error);
    next(error);
  }
}

// forgot password
async function forgotPassword(req: any, res: any, next: any) {
  try {
    const { email } = req.body;
    const user: any = await customersObj.findUserByEmail(email);

    if (user.error) {
      return res.send(functionsObj.output(0, user.message));
    }

    // Generate Reset Token
    const resetToken = jwt.sign(
      { reset: true } as object, // Explicitly define the payload as an object
      process.env.JWT_SECRET as string, // Ensure JWT_SECRET is a string
      {
        expiresIn: "10m",
      }
    );

    const resetTokenExpiry = new Date(Date.now() + 10 * 60000)
      .toISOString()
      .replace("T", " ")
      .slice(0, -1);

    const updateToken: any = await customersObj.updateResetToken(
      email,
      resetToken,
      resetTokenExpiry
    );

    if (updateToken.error) {
      return res.send(functionsObj.output(0, updateToken.message));
    }

    const resetLink = `http://localhost:8000/v1/customer/reset-password?token=${resetToken}&email=${email}`;

    await mailService.sendResetLink(email, resetLink);

    return res.send(
      functionsObj.output(1, "Reset link sent to your email.", { resetLink })
    );
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    next(error);
  }
}

// reset password schema
function resetPasswordSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .trim() // Trim any leading or trailing spaces
      .required()
      .replace(/ /g, "")
      .messages({
        "string.empty": "Email is required",
        "string.email": "Invalid email format",
      }),

    newPassword: Joi.string()
      .pattern(
        new RegExp(
          "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,15}$"
        )
      )
      .required()
      .trim()
      .replace(/ /g, "") // Trim any leading or trailing spaces
      .messages({
        "string.base": "Password must be a string",
        "string.empty": "Password is required",
        "string.pattern.base":
          "Password must be 8-15 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      }),

    confirmPassword: Joi.string()
      .required()
      .valid(Joi.ref("newPassword")) // Ensures it matches newPassword
      .trim()
      .replace(/ /g, "") // Trim any leading or trailing spaces
      .messages({
        "any.only": "Confirm password must match new password",
        "string.empty": "Confirm password is required",
      }),

    resetToken: Joi.string()
      .required()
      .trim()
      .replace(/ /g, "") // Trim any leading or trailing spaces
      .messages({
        "string.empty": "Token is required",
      }),
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

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.send(functionsObj.output(0, "Passwords do not match."));
    }

    // Find user by email
    const user: any = await customersObj.findUserByEmail(email);
   // console.log(user.cust_email);
    if (user.error || !user.data) {
      return res.send(functionsObj.output(0, user.message));
    }

    const { cust_resettoken, cust_resettoken_expiry } = user.data;
   

    // Check if the reset token is valid
    if (!cust_resettoken || resetToken !== cust_resettoken) {
      return res.send(functionsObj.output(0, "Invalid or expired token."));
    }

    // Check if the reset token has expired
    let expiryTime = new Date(cust_resettoken_expiry + " UTC");
     const currentTime = new Date();
    if (currentTime > expiryTime) {
      return res.send(functionsObj.output(0, "Token has expired."));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    const updateSuccess: any = await customersObj.updatePassword(
      email,
      hashedPassword
    );
    if (updateSuccess.error) {
      return res.send(functionsObj.output(0, updateSuccess.message));
    } else {
      return res.send(
        functionsObj.output(1, updateSuccess.message, updateSuccess.data)
      );
    }
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return next(error);
  }
}

//get all user
async function getAllUsers(req: any, res: any, next: any) {
  try {
    let users = await customersObj.getAllUser();
   // console.log("u", users);
    if (users.error) {
      return res.send(functionsObj.output(0, users.message));
    } else {
      return res.send(functionsObj.output(1, users.message, users.data));
    }
  } catch (error) {
    console.error("Error in fetched user:", error);
    return next(error);
  }
}

// updateprofile schema

function updateProfileSchema(req: Request, res: any, next: any) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).trim().replace(/ /g, "").messages({
      "string.empty": "name is required",
    }),
    phone: Joi.string()
      .length(10)
      .pattern(/^[0-9]+$/)
      .required()
      .replace(/ /g, "")
      .trim()
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

//update-profile
async function updateUserProfile(req: any, res: any, next: any) {
  try {
    const { name, phone } = req.body;
    const id = req.user.id; // Get authenticated user ID
    console.log(id);
    // Call the updateUserProfile function from dbcustomers model
    const result = await customersObj.updateUserProfile(id, name, phone);

    // Send response
    if (result.error) {
      return res.send(functionsObj.output(0, result.message));
    } else {
      return res.send(functionsObj.output(1, result.message, result.data));
    }
  } catch (error) {
    console.error("Error in updateUserProfileController:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// get one user profile
async function getOneUser(req: any, res: any, next: NextFunction) {
  try {
    if (!req.user) {
      return res.send(
        functionsObj.output(0, "Unauthorized: No user data found")
      );
    }

    const userId = req.user.id;
    // console.log("uid",userId)
    const user = await customersObj.findUserById(userId);
    // console.log("Fetched user:", user);

    if (!user || user.error) {
      return res.send(
        functionsObj.output(0, user?.message || "User not found")
      );
    }

    return res.send(functionsObj.output(1, user.message, user.data));
  } catch (error) {
    console.error("Error fetching user:", error);
    return next(error);
  }
}

// email schema
function emailSchema(req: any, res: any, next: any) {
  const schema = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .lowercase()
      .trim()
      .required()
      .replace(/ /g, "")
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Invalid email format.",
      }),
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

    if (!email) {
      return res.status(400).send(functionsObj.output(0, "Email is required"));
    }

    const user = await customersObj.findUserByEmail(email);
   // console.log("Fetched user:", user);

    if (!user || user.error) {
      // Email not registered, suggest registration
      return res
        .status(404)
        .send(functionsObj.output(0, "Email not registered. Please sign up."));
    }

    // Email exists, suggest login
    return res
      .status(200)
      .send(
        functionsObj.output(
          1,
          "Email is already registered. Please log in to continue.",
          user.data
        )
      );
  } catch (error) {
    console.error("Error checking email:", error);
    return next(error);
  }
}

//delete -profile

async function deleteUser(req: any, res: any, next: any) {
  try {
    if (!req.user) {
      return res
        .status(401)
        .send(functionsObj.output(0, "Unauthorized: No user data found"));
    }

    const userId = req.user.id;
    const result = await customersObj.deleteUserProfile(userId);

    if (result.error) {
      return res.status(404).send(functionsObj.output(0, result.message));
    }

    return res
      .status(200)
      .send(functionsObj.output(1, result.message, result.data));
  } catch (error) {
    console.error("Error deleting user:", error);
    return next(error);
  }
}
