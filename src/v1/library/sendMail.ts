
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); 

export class MailService 
{

private transporter: nodemailer.Transporter;

constructor() {
  // Verify required environment variables
  if (!process.env.USER_EMAIL || !process.env.USER_PASS) {
    throw new Error("Missing SMTP credentials in .env file");
  }

  // Configure nodemailer transporter
  this.transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER_EMAIL,
      pass: process.env.USER_PASS, // Use App Password if 2FA is enabled
    },
  });

}

  // Send OTP email for verification
public async sendOTPMail(email: string, otp: number) {
    await this.transporter.sendMail({
      from: `"Your Company Name" <${process.env.USER_EMAIL}>`, 
      to: email,
      subject: "Email Verification OTP",
      text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong>. It is valid for 10 minutes.</p>`,
    });
  }

  // Send reset link email
public async sendResetLink(email: string, resetLink: string){
    await this.transporter.sendMail({
      from: `"Your Company Name" <${process.env.USER_EMAIL}>`,
      to: email,
      subject: "Forgot Password Link",
      text: `Your reset link is: ${resetLink}. It is valid for 1 hour.`,
      html: `<p>Your reset link is: <a href="${resetLink}">${resetLink}</a>. It is valid for 1 hour.</p>`,
    });
  }

  // Send OTP for order verification
public async sendOrderOTPMail( orderId:number,email: string,otp: number){
    await this.transporter.sendMail({
      from: `"Your Company Name" <${process.env.USER_EMAIL}>`,
      to: email,
      subject: "Order Verification OTP",
      html: `
        <h1>Order Verification</h1>
        <p>Dear Customer,</p>
        <p>Your order with ID <strong>#${orderId}</strong> has been delivered!</p>
        <p>Please verify your order using the OTP below:</p>
        <h2><strong>${otp}</strong></h2>
        <p>Enter the OTP on our platform to complete the verification process.</p>
        <p>If you did not place this order, please contact our support team immediately.</p>
        <br/>
        <p>Best regards,</p>
        <p>Your Company Name</p>
      `,
    });
  }
}
