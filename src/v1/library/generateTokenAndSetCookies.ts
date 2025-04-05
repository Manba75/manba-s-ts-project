import jwt from "jsonwebtoken";
import dotenv from "dotenv";


dotenv.config();

export const generateTokenAndSetCookies = (res: any, userId: number): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables.");
  }

  const token: string = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "10d",
  });

  res.cookie('token', token, {
    httpOnly: true,
    secure:true, 
    sameSite:'None',  
    maxAge: 3600000  
  });
  return token;
};

