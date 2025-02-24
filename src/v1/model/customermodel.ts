import { appdb } from "./appdb";
import { MailService } from "../library/sendMail";
import { number } from "joi";
export class dbcustomers extends appdb {
  constructor() {
    super();
    this.table = "customers";
    this.uniqueField = "id";
  }

  /* Checking if email exists and creating customer */
  async createCustomer(
    email: string,
    password: string,
    otp: number, // OTP should be an integer
    createdIP: string
  ) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      // Securely checking if customer exists
      this.where = `WHERE cust_email = '${email}'`; // Fix: Use parameterized queries in production
      let existingUser: any[] = await this.listRecords("*");

      if (existingUser.length > 0) {
        const user = existingUser[0];

        if (!user.is_deleted) {
          return_data.message = "Email already exists.";
          return return_data;
        }

        // If user is deleted, update and reactivate the account
        let updateData = {
          cust_password: password,
          cust_isverify: false,
          cust_verifyotp: otp, // Integer type OTP
          cust_expiryotp: new Date(Date.now() + 10 * 60000)
            .toISOString()
            .replace("T", " ")
            .slice(0, -1),
          cust_updated_on: new Date()
            .toISOString()
            .replace("T", " ")
            .slice(0, -1),
          cust_created_ip: createdIP,
          is_deleted: false,
        };

        let updateResult = await this.updateRecord(user.id, updateData);
        if (!updateResult) {
          return_data.message = "Customer update error";
          return return_data;
        }

        return_data.error = false;
        return_data.data = updateResult;
        return_data.message = "Account reactivated successfully";
        return return_data;
      }

      // If user does not exist, create a new one
      let insertData = {
        cust_email: email,
        cust_password: password,
        cust_isverify: false,
        cust_verifyotp: otp,
        cust_expiryotp: new Date(Date.now() + 10 * 60000)
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
        cust_created_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
        cust_created_ip: createdIP,
        is_deleted: false,
      };

      let insertResult = await this.insertRecord(insertData);
      if (!insertResult) {
        return_data.message = "Customer creation error";
        return return_data;
      }

      return_data.error = false;
      return_data.data = insertResult;
      return_data.message = "Successfully created user";
      return return_data;
    } catch (error) {
      console.error("Database Insert Error:", error); // Debugging log
      return_data.error = true;
      return_data.message = "Error inserting record into database";
      return return_data;
    }
  }
  // verify user oTP
  async verifyUserOTP(email: string, otp: number | null) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      // Fetch user details using email
      this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let existingUser: any[] = await this.listRecords("*");

      if (existingUser.length === 0) {
        return_data.message = "User not found.";
        return return_data;
      }

      let user = existingUser[0];

      // Check if OTP matches
      if (user.cust_verifyotp !== otp) {
        return_data.message = "Invalid OTP.";
        return return_data;
      }

      let storedExpiryTime = new Date(user.cust_expiryotp + " UTC"); // Force UTC interpretation
      let currentTime = new Date(); // Already in UTC

      // console.log("Current Time (UTC):", currentTime.toISOString());
      // console.log("OTP Expiry Time (UTC):", storedExpiryTime.toISOString());

      if (currentTime > storedExpiryTime) {
        return_data.message = "OTP has expired.";
        return return_data;
      }

      // Update user verification status
      let updateData = {
        cust_isverify: true,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
       
      };

      console.log(updateData);

      let updateResult = await this.updateRecord(user.id, updateData);
      // console.log(updateResult);
      if (!updateResult) {
        return_data.message = "Error updating user verification status.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "User verified successfully.";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return_data.error = true;
      return_data.message = "Error verifying OTP.";
      return return_data;
    }
  }

  // resend otp
  /**
   * Resend OTP function
   * @param email - User email to resend OTP
   * @returns Response object with status and message
   */
  async resendOTP(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      // Check if the user exists and is not deleted
      this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let existingUser: any[] = await this.listRecords("*");

      if (existingUser.length === 0) {
        return_data.message = "User not found.";
        return return_data;
      }

      let user = existingUser[0];
      // console.log("user", user);

      // Generate a new OTP (6-digit)
      const generateOTP = require("../library/generateOTP");
      let newOTP: number = generateOTP();
      // console.log("oyp", newOTP);
      // Set OTP expiration time (10 minutes from now)
      let otpExpiryTime: string | null = new Date(Date.now() + 10 * 60000)
        .toISOString()
        .replace("T", " ")
        .slice(0, -1);
      // console.log("oyp", otpExpiryTime);
      // Update the OTP and expiry time in the database

      let updateData = {
        cust_verifyotp: Number(newOTP),
        cust_expiryotp: otpExpiryTime,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };
      // console.log("u5", updateData);
      //   this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let updateResult = await this.updateRecord(user.id, updateData);
      // console.log("u", updateResult);
      if (!updateResult) {
        return_data.message = "not update otp.";
        return return_data;
      } else {
        let mailService = new MailService();
        await mailService.sendOTPMail(email, newOTP);

        return_data.error = false;
        return_data.message =
          "OTP resent successfully. Please check your email.";
        return return_data;
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      return_data.error = true;
      return_data.message = "Error while resending OTP.";
      return return_data;
    }
  }

  //login and finding user
  /**
   * Find user by email for login
   * @param email - User email
   * @returns - User record or error
   */
  async findUserByEmail(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      this.where = `WHERE cust_email = '${email}' AND is_deleted=false`;
      let result = await this.listRecords("*");

      if (result.length === 0) {
        return_data.message = "User not found";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "login successfully";
      return_data.data = result[0];
      return return_data;
    } catch (error) {
      console.error("Database Query Error:", error);
      return_data.message = "Database error while fetching user";
      return return_data;
    }
  }

  /**
   * Update last login timestamp
   * @param email - User email
   * @returns - Success or failure response
   */
  async updateLastLogin(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData = {
        cust_last_login: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };

      let updateResult = await this.update(
        this.table,
        updateData,
        `WHERE cust_email = '${email}'`
      );

      if (!updateResult) {
        return_data.message = "Failed to update last login";
        return return_data;
      }

      return_data.error = false;
      return return_data;
    } catch (error) {
      console.error("Database Update Error:", error);
      return_data.message = "Error updating ";
      return return_data;
    }
  }
  // updated reset token
  async updateResetToken(
    email: string,
    resetToken: string | null,
    resetTokenExpiry: string | null
  ) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData: any = {
        cust_resettoken: resetToken ?? null,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };

      if (resetTokenExpiry === null || resetTokenExpiry === "") {
        updateData.cust_resettoken_expiry = null;
      } else {
        updateData.cust_resettoken_expiry = resetTokenExpiry;
      }

      console.log("Final updateData before query:", updateData);
      let updateResult = await this.update(
        this.table,
        updateData,
        `WHERE cust_email = '${email}'`
      );

      if (!updateResult) {
        return_data.message = "failed to update resettoken";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Updated reset token";
      return return_data;
    } catch (error) {
      console.error("Database Update Error:", error);
      return_data.message = "Error updating last login";
      return return_data;
    }
  }
  // updated password
  async updatePassword(email: string, password: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData = {
        cust_password: password,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };

      let updateResult = await this.update(
        this.table,
        updateData,
        `WHERE cust_email = '${email}'`
      );

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "User not found or password update failed.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Password updated successfully.";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      console.error("Database Update Error:", error);
      return_data.message = "Error updating password.";
      return return_data;
    }
  }

  // get all users
  async getAllUser() {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      // Ensure correct Boolean comparison depending on DB type
      this.where = "WHERE is_deleted= false";
      let users = await this.listRecords("*");

      if (!users || users.length === 0) {
        return_data.message = "No active users found.";
      } else {
        return_data.error = false;
        return_data.data = users;
        return_data.message = "Retrieved all active user data successfully.";
      }
    } catch (error) {
      console.error("Error fetching users from database:", error);
      return_data.message = "Error fetching user data.";
    }

    return return_data;
  }

  //update profile
  async updateUserProfile(id: number, name: string, phone: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      let updateData = {
        cust_name: name,
        cust_phone: phone,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };

      let updateResult = await this.update(
        this.table,
        updateData,
        `WHERE id = ${id} AND is_deleted = false`
      );

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "User not found or profile update failed.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Profile updated successfully.";
      return_data.data = updateData;
      return return_data;
    } catch (error) {
      console.error("Database Update Error:", error);
      return_data.message = "Error updating profile.";
      return return_data;
    }
  }

  // find user by id
  async findUserById(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      // Fetch user record
      let userResult = await this.selectRecord(id, "*");

      if (!userResult || userResult.length === 0) {
        return_data.message = "User not found.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "User profile retrieved successfully.";
      return_data.data = userResult[0]; // Assuming selectRecord returns an array
      return return_data;
    } catch (error) {
      console.error("Database Fetch Error:", error);
      return_data.message = "Error fetching user profile.";
      return return_data;
    }
  }

  // delete user
  async deleteUserProfile(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      let updateData = {
        is_deleted: true,
        cust_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };

      // Update user to mark as deleted
      let userResult = await this.update(
        this.table,
        updateData,
        `WHERE id='${id}' `
      );

      if (!userResult) {
        return_data.message = "User not found or already deleted.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "User deleted successfully.";
      return_data.data = updateData; // Returning updated data
      return return_data;
    } catch (error) {
      console.error("Database Fetch Error:", error);
      return_data.message = "Error deleting user profile.";
      return return_data;
    }
  }

  //update socket id
  async updateSocketId(customerId: number, socketId: string) {
  
     let return_data = {
       error: true,
       message: "",
       data: {} as any,
     };

     try {
       // Fetch user record
       let userResult = await this.update(
         this.table,
         { socket_id: socketId },
         `WHERE id = ${customerId}`
       );;

       if (!userResult || userResult.length === 0) {
         return_data.message = " not update socket id.";
         return return_data;
       }

       return_data.error = false;
       return_data.message = "User socket id updated successfully.";
       return_data.data = userResult[0]; // Assuming selectRecord returns an array
       return return_data;
     } catch (error) {
       console.error("Database Fetch Error:", error);
       return_data.message = "Error fetching user profile.";
       return return_data;
     }
  }

  // customer order get
  
}
