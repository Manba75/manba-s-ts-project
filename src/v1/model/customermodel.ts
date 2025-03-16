import { appdb } from "./appdb";
import { MailService } from "../library/sendMail";
import { boolean, number } from "joi";
import { generateOTP } from "../library/generateOTP";
export class dbcustomers extends appdb {
  constructor() {
    super();
    this.table = "customers";
    this.uniqueField = "id";
  }


  /* Checking if email exists and creating customer */
async createCustomer(email: string,password: string, otp: number,createdIP: string ) {
    let return_data: { error: boolean; message: string; data: any } = {
      error: true,
      message: "",
      data: {},
    };

    try {
      this.where = `WHERE cust_email = '${email}'`; 
      let existingUser: any[] = await this.allRecords("*");

      if (existingUser.length > 0) {
        const user = existingUser[0];

        if (!user.is_deleted) {
          return_data.message = "CUSTOMER_EXISTS";
          
          return return_data;
        }

        let updateData = {
          cust_password: password,
          cust_isverify: false,
          cust_verifyotp: otp, 
          cust_expiryotp: new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1),
          cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          cust_created_ip: createdIP,
          is_deleted: false,
        };

        let updateResult = await this.updateRecord(user.id, updateData);
        if (!updateResult) {
          return_data.message = "CUSTOMER_INSERT_ERROR";
          return return_data;
        }

        return_data.error = false;
        return_data.data = updateResult;
        return_data.message = "CUSTOMER_INSERT_SUCCESS";
        return return_data;
      }

     
      let insertData = {
        cust_email: email,
        cust_password: password,
        cust_isverify: false,
        cust_verifyotp: otp,
        cust_expiryotp: new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1),
        cust_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
        cust_created_ip: createdIP,
        is_deleted: false,
      };

      let insertResult = await this.insertRecord(insertData);
      if (!insertResult) {
        return_data.message = "VEHICLE_INSERT_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.data = insertResult;
      return_data.message = "CUSTOMER_INSERT_SUCCESS";
      return return_data;
    } catch (error) {
      return_data.error = true;
      return_data.message = "CUSTOMER_INSERT_ERROR";
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
      
      this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let existingUser: any[] = await this.allRecords("*");

      if (existingUser.length === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      let user = existingUser[0];
      if (user.cust_verifyotp !== otp) {
        return_data.message = "OTP_INVALID";
        return return_data;
      }

      let storedExpiryTime = new Date(user.cust_expiryotp + " UTC"); 
      let currentTime = new Date(); 
      if (currentTime > storedExpiryTime) {
        return_data.message = "OTP has expired.";
        return return_data;
      }

      let updateData = {
        cust_isverify: true,
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };


      let updateResult = await this.updateRecord(user.id, updateData);
      if (!updateResult) {
        return_data.message = "OTP_VERIFY_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "CUSTOMER_VERIFIED_SUCCESS";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
    
      return_data.error = true;
      return_data.message = "OTP_VERIFY_ERROR";
      return return_data;
    }
  }

  /**
   * Resend OTP function
   */
async resendOTP(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let existingUser: any[] = await this.allRecords("*");

      if (existingUser.length === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      let user = existingUser[0];
     
      let newOTP: number = generateOTP();
      let otpExpiryTime: string | null = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);

      let updateData = {
        cust_verifyotp: Number(newOTP),
        cust_expiryotp: otpExpiryTime,
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };
      let updateResult = await this.updateRecord(user.id, updateData);
      if (!updateResult) {
        return_data.message = "OTP_RESEND_ERROR";
        return return_data;
      } 
      let mailService = new MailService();
      await mailService.sendOTPMail(email, newOTP);

      return_data.error = false;
      return_data.message ="OTP_RESEND_SUCCESS";
      return return_data;
    
    } catch (error) {
      
      return_data.error = true;
      return_data.message = "OTP_RESEND_ERROR";
      return return_data;
    }
  }

  /**
   * Find user by email for login
  
   */
async findUserByEmail(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      this.where = `WHERE cust_email = '${email}' AND is_deleted=false`;
      let result = await this.allRecords("*");

      if (result.length === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "CUSTOMER_FOUND";
      return_data.data = result[0];
      return return_data;

    } catch (error) {
     
      return_data.message = "CUSTOMER_FETCH_ERROR";
      return return_data;
    }
  }

  /**
   * Update last login timestamp
   */
async updateLastLogin(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData = {
        cust_last_login: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table,updateData,`WHERE cust_email = '${email}'`);

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
async updateResetToken( email: string,resetToken: string | null,resetTokenExpiry: string | null) 
{
    
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData: any = {
        cust_resettoken: resetToken ?? null,
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      if (resetTokenExpiry === null || resetTokenExpiry === "") {
        updateData.cust_resettoken_expiry = null;
      } else {
        updateData.cust_resettoken_expiry = resetTokenExpiry;
      }
      let updateResult = await this.update(this.table,updateData,`WHERE cust_email = '${email}'`);

      if (!updateResult) {
        return_data.message = "failed to update resettoken";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Updated reset token";
      return return_data;
    } catch (error) {
      
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
        cust_updated_on: new Date().toISOString().replace("T", " ") .slice(0, -1),
      };

      let updateResult = await this.update(this.table,updateData,`WHERE cust_email = '${email}'`);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "RESET_PASSWORD_SUCCESS";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      
      return_data.message = "RESET_PASSWORD_ERROR";
      return return_data;
    }
  }

  // get all users
async getAllUser() {
    let return_data = {
      error: true,
      message: "",
      data: {results:new Array()},
    };

    try {
      this.where = "WHERE is_deleted= false";
      let users = await this.allRecords("*");

      if (!users || users.length === 0) {
        return_data.message = "CUSTOMERS_NOT_FOUND";
      } 
      return_data.error = false;
      return_data.data = users;
      return_data.message = "CUSTOMERS_FETCH_SUCCESS";
      
    } catch (error) {
     
      return_data.message = "CUSTOMERS_FETCH_ERROR";
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
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.updateRecord(id,updateData);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "CUSTOMER_UPDATE_PROFILE_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "CUSTOMER_UPDATE_PROFILE_SUCCESS";
      return_data.data = updateData;
      return return_data;
    } catch (error) {
     
      return_data.message = "CUSTOMER_UPDATE_PROFILE_ERROR";
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
      let userResult = await this.selectRecord(id, "*");

      if (!userResult || userResult.length === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "CUSTOMER_FETCH_SUCCESS";
      return_data.data = userResult[0]; 
      return return_data;
    } catch (error) {
    
      return_data.message = "CUSTOMER_FETCH_ERROR";
      return return_data;
    }
  }

  // delete user
  async deleteUserProfile(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: 0,
    };

    try {
      let updateData = {
        is_deleted: true,
        cust_updated_on: new Date().toISOString().replace("T", " ") .slice(0, -1),
      };

      let userResult = await this.updateRecord(id,updateData)

      if (!userResult) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "CUSTOMER_DELETED_SUCCESS";
      return_data.data = userResult; 
      return return_data;
    } catch (error) {
      
      return_data.message = "CUSTOMER_DELETE_ERROR";
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
      let updateData= { socket_id: socketId }
  
      let userResult = await this.updateRecord(customerId, updateData);

       if (!userResult || userResult.length === 0) {
         return_data.message = "CUSTOMER_UPDATE_SOCKETID_ERROR";
         return return_data;
       }

       return_data.error = false;
       return_data.message = "CUSTOMER_UPDATE_SOCKETID_SUCCESS";
       return_data.data = userResult[0]; 
       return return_data;
     } catch (error) {
      
       return_data.message = "CUSTOMER_UPDATE_SOCKETID_ERROR";
       return return_data;
     }
  }

  // get socket id 
  async getCustomerSocketId(customerId: number) {
    let return_data = {
      error: true,
      message: " ",
      data: {},
    };
  
    try {
      let custResult = await this.selectRecord(customerId,"socket_id");
  
      if (custResult.length === 0) {
        return_data.message = "CUSTOMER_SOCKETID_FETCH_ERROR";
        return return_data;
      } else {
        return_data.error = false;
        return_data.message = "CUSTOMER_SOCKETID_FETCH_SUCCESS";
        return_data.data = custResult[0];
        return return_data;
      }
    } catch (error) {
      
      return_data.message = "CUSTOMER_SOCKETID_FETCH_ERROR";
      return return_data;
    }
  }
  
}
