import { appdb } from "./appdb";
import { MailService } from "../library/sendMail";
import { boolean, number } from "joi";
import { generateOTP } from "../library/generateOTP";
import bcrypt from "bcrypt";
import { Socket } from "socket.io";
import { generateTokenAndSetCookies } from "v1/library/generateTokenAndSetCookies";
import jwt from "jsonwebtoken";
import { dbCity } from "./citymodel";
export class dbcustomers extends appdb {
  citymodel: dbCity;
  constructor() {
    super();
    this.table = "customers";
    this.uniqueField = "id";
    this.citymodel = new dbCity();
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

      let data= await this.selectRecord(insertResult, "*");
      if(data.length===0){
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }
      let user = data[0];

      return_data.error = false;
      return_data.data = {insertResult,user};
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
        // cust_verifyotp: '',
        // cust_expiryotp: '',
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };


      let updateResult = await this.updateRecord(user.id, updateData);
      if (!updateResult) {
        return_data.message = "OTP_VERIFY_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Customer verified successfully";
      return_data.data = { user, updateResult };
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
      return_data.data={newOTP,email}
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
      let user:any= result[0];
      if (result.length === 0) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }
      if(!user.cust_isverify){
        return_data.error=false
        return_data.message = "CUSTOMER_NOT_VERIFIED";
        return_data.data = user;
        return return_data;
      }
      return_data.error = false;
      return_data.message = "CUSTOMER_EXISTS";
      return_data.data = user;
      return return_data;

    } catch (error) {
     
      return_data.message = "CUSTOMER_FETCH_ERROR";
      return return_data;
    }
  }

  /** login user */

async loginUser(email: string, password: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
    
      let userResponse = await this.findUserByEmail(email);
          if (userResponse.error) {
            return_data.message = "CUSTOMER_NOT_FOUND";
            return return_data;
           
          }
          let user =  userResponse.data;
          const isMatch = await bcrypt.compare(password, user.cust_password);
          if (!isMatch) {
            return_data.message = "EMAIL_PASSWORD_MATCH_ERROR";
            return return_data;
           
          }
          if (!user.cust_isverify) {
            return_data.message = "CUSTOMER_NOT_VERIFIED";
            return return_data;
         
          }
          const updateLastLoginResponse: any = await this.updateLastLogin(email);
          if (updateLastLoginResponse.error) {
            return_data.message = "CUSTOMER_LOGIN_ERROR";
            return return_data;
        
          }
          let updatesocketid: any = await this.updateSocketId(user.id,user.socketId);
          if (updatesocketid.error) {
            return_data.message = "CUSTOMER_LOGIN_ERROR";
            return return_data;
         
          }
          
          
      let Socketid = updatesocketid.data;
      return_data.error = false;
      return_data.message = "CUSTOMER_LOGIN_SUCCESS";
      return_data.data = {
       user,
        Socketid:Socketid
      }
    
      return return_data;

    } catch (error) {
      return_data.message = "CUSTOMER_LOGIN_ERROR";
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

//forgotpassword
async customerforgotPassword(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let user = await this.findUserByEmail(email);
      if (user.error) {
         return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }
      const resetToken = jwt.sign({ reset: true } as object, process.env.JWT_SECRET as string, { expiresIn: "10m" });
      const resetTokenExpiry = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);
      const updateToken: any = await this.updateResetToken(email, resetToken, resetTokenExpiry);
      if (updateToken.error) {
        return_data.message = "RESET_PASSWORD_ERROR";
        return return_data;
      }
      const resetLink = `http://localhost:4200/customer/reset-password?token=${resetToken}&email=${email}`;
      let mailService = new MailService();
      await mailService.sendResetLink(email, resetLink);
     
      return_data.error = false;
      return_data.message = "FORGOT_PASSWORD_SUCCESS";
      return_data.data = { resetLink: resetLink ,email:email ,resetToken:resetToken};
      return return_data;
    } catch (error) {
      
      return_data.message = "RESET_PASSWORD_ERROR";
      return return_data;
    }
}

  // updated password
  async updatePassword(email: string, password: string, resetToken: string) 
  {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {

      const user = await this.findUserByEmail(email);
      console.log("uu",user.data.cust_email)
      if (user.error || user.data.cust_isverify === false) {
        return_data.message = "CUSTOMER_NOT_FOUND";
        return return_data;
      }

      const { cust_resettoken, cust_resettoken_expiry } = user.data;
 
      if (!cust_resettoken || resetToken !== cust_resettoken) {
        return_data.message = "TOKEN_INVALID";
        return return_data;
      }

     
      let expiryTime = new Date(cust_resettoken_expiry + " UTC");
      if (new Date() > expiryTime) {
        return_data.message = "TOKEN_EXPIRED";
        return return_data;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let updateData = {
        cust_password: hashedPassword,
        // cust_resettoken: null,
        // cust_resettoken_expiry: null,
        cust_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table, updateData, `WHERE cust_email = '${email}'`);
      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "PASSWORD_UPDATE_FAILED";
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
  async updateUserprofile(id: number, name: string, phone: string, street: string, flatno: string, landmark: string, city: string, zip: string, latitude: number, longitude: number) {
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
        
        let updateResult = await this.updateRecord(id, updateData);
        
        if (!updateResult || updateResult.rowCount === 0) {
            return_data.message = "CUSTOMER_UPDATE_PROFILE_ERROR";
            return return_data;
        }

        // Store updated address in address table
        let addressData = {
            cust_id: id,
            address_street :street,
            address_flatno: flatno,
            address_landmark: landmark,
            address_city_id: await this.citymodel.getCityIdByCityName(city), // Store city in city table
            address_pincode: zip,
            address_latitude: latitude,
            address_longitude: longitude,
            updated_on: new Date().toISOString().replace("T", " ").slice(0, -1)
        };

        await this.insert("address", addressData);


        return_data.error = false;
        return_data.message = "CUSTOMER_UPDATE_PROFILE_SUCCESS";
        return_data.data = { ...updateData, address: addressData };
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
