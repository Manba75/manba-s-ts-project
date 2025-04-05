import { appdb } from "./appdb";
import { MailService } from "../library/sendMail";
import { generateOTP } from "../library/generateOTP";
import { dbVehicles } from "./vehiclemodel";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbCity } from "./citymodel";
import { dbVehicleType } from "./vehicletypemodel";
import { log } from "console";
export class dbDpartners extends appdb {
  vehiclemodel: dbVehicles;
  citymodel: dbCity;
  vehicletypemodel: dbVehicleType;

  constructor() {
    super();
    this.table = "deliverypartners";
    this.uniqueField = "id";
    this.vehiclemodel = new dbVehicles();
    this.citymodel = new dbCity();
    this.vehicletypemodel = new dbVehicleType();
  }

  // Check email
  async checkEmail(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };
    try {
      this.where = `WHERE dpartner_email = '${email}'`;
      const result = await this.allRecords("*");

      if (result.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "DPARTNER_EXISTS";
      return_data.data = result[0];
      return return_data;
    } catch (error) {
      return_data.message = "DATABASE_ERROR_FETCHING_DPARTNER";
      return return_data;
    }
  }

  // Signup
  async insertDpartner(city: string, vehicletype: string, dpartner_email: string, dpartner_pass: string, dpartner_created_ip: string, dpartner_licence: string, dpartner_phone: string, vehicle_number: string, vehicle_name: string, otp: number) {
    let return_data = { error: true, message: "", data: {} };
  
    try {
      await this.executeQuery("BEGIN");
  
      // Get city ID
      let city_id: any = await this.citymodel.getCityIdByCityName(city);
      if (city_id.error) {
        return_data.message = city_id.message;
        return return_data;
      }
  
      // Get vehicle type ID
     
      let vehicleType_id: any = await this.vehicletypemodel.getVehicleTypeIdByName(vehicletype);
      if (vehicleType_id.error) {
        return_data.message = vehicleType_id.message;
        return return_data;
      }
  
      // Check if email already exists
      this.where = `WHERE dpartner_email = '${dpartner_email}'`;
      const existingDpartner = await this.allRecords("*");
      let dpartner_id: number;
      let dpartnerResult;
  
      if (existingDpartner.length > 0) {
        const dpartner = existingDpartner[0];
  
        // If soft deleted, reactivate it
        if (dpartner.dpartner_is_deleted) {
          const updateData = {
            dpartner_password: dpartner_pass,
            dpartner_phone,
            dpartner_city_id: city_id.data,
            dpartner_created_ip,
            dpartner_licence_number: dpartner_licence,
            dpartner_isverify: false,
            dpartner_verifyotp: otp,
            dpartner_expiryotp: new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1),
            dpartner_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
            dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
            dpartner_last_login: new Date().toISOString().replace("T", " ").slice(0, -1),
            dpartner_is_deleted: false,
          };
          
          dpartnerResult = await this.updateRecord(dpartner.id, updateData);
          if (!dpartnerResult) {
            return_data.message = "FAILED_TO_REACTIVATE_DPARTNER";
            return return_data;
          }
          dpartner_id = dpartner.id;
        } else {
          return_data.message = "EMAIL_ALREADY_EXISTS";
          return return_data;
        }
      } else {
        // Insert new delivery partner
        const insertData = {
          dpartner_email,
          dpartner_password: dpartner_pass,
          dpartner_phone,
          dpartner_city_id: city_id.data,
          dpartner_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          dpartner_created_ip,
          dpartner_last_login: new Date().toISOString().replace("T", " ").slice(0, -1),
          dpartner_isavailable: false,
          dpartner_licence_number: dpartner_licence,
          dpartner_isverify: false,
          dpartner_verifyotp: otp,
          dpartner_expiryotp: new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1),
          dpartner_is_deleted: false,
        };
  
        dpartnerResult = await this.insertRecord(insertData);
        if (!dpartnerResult) {
          return_data.message = "FAILED_TO_CREATE_DPARTNER";
          return return_data;
        }
  
        dpartner_id = dpartnerResult;
      }
  
      // Insert or update vehicle details
      const vehicleResult = await this.vehiclemodel.insertOrUpdateVehicle(dpartner_id, vehicleType_id.data.id, vehicle_number, vehicle_name, dpartner_created_ip);
      if (vehicleResult.error) {
        return_data.message = "VEHICLE_INSERT_ERROR";
        return return_data;
      }

      let data= await this.selectRecord(dpartnerResult, "*");
      if(data.length===0){
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }
      let user = data[0];
  
      await this.executeQuery("COMMIT");
  
      return_data.error = false;
      return_data.message = "DPARTNER_CREATED_SUCCESSFULLY";
      return_data.data = { dpartnerResult, vehicle: vehicleResult.data, user: user };
  
      return return_data;
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "DATABASE_ERROR";
      return return_data;
    }
  }
  

  // Verify dpartner OTP
  async verifydpartnerOTP(email: string, otp: number | null) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      this.where = `WHERE dpartner_email = '${email}' AND dpartner_is_deleted = false`;
      let existingdpartner: any[] = await this.allRecords("*");

      if (existingdpartner.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }

      let dpartner = existingdpartner[0];

      if (dpartner.dpartner_verifyotp !== otp) {
        return_data.message = "INVALID_OTP";
        return return_data;
      }

      let storedExpiryTime = new Date(dpartner.dpartner_expiryotp + " UTC");
      let currentTime = new Date();

      if (currentTime > storedExpiryTime) {
        return_data.message = "OTP_EXPIRED";
        return return_data;
      }

      let updateData = {
        dpartner_isverify: true,
        // dpartner_verifyotp: null,
        // dpartner_expiryotp: null,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.updateRecord(dpartner.id, updateData);

      if (!updateResult) {
        return_data.message = "ERROR_UPDATING_VERIFICATION_STATUS";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "DPARTNER_VERIFIED_SUCCESSFULLY.";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_VERIFYING_OTP";
      return return_data;
    }
  }

  // Resend OTP
  async resendOTP(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      this.where = `WHERE dpartner_email = '${email}' AND dpartner_is_deleted = false`;
      let existingdpartner: any[] = await this.allRecords("*");

      if (existingdpartner.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }

      let dpartner = existingdpartner[0];

      let newOTP: number = generateOTP();
      let otpExpiryTime: string | null = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);

      let updateData = {
        dpartner_verifyotp: Number(newOTP),
        dpartner_expiryotp: otpExpiryTime,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };
      let updateResult = await this.updateRecord(dpartner.id, updateData);
      if (!updateResult) {
        return_data.message = "ERROR_RESENDING_OTP";
        return return_data;
      }
      let mailService = new MailService();
      await mailService.sendOTPMail(email, newOTP);

      return_data.error = false;
      return_data.message = "OTP_RESENT_SUCCESSFULLY";
      return return_data;
    } catch (error) {
      return_data.message = "Error while resending OTP.";
      return return_data;
    }
  }

  // Login and finding dpartner
  async finddpartnerByEmail(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      this.where = `WHERE dpartner_email = '${email}' AND dpartner_is_deleted=false`;
      let result = await this.allRecords("*");
      let user=result[0];
      if (result.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }
      if(!user.dpartner_isverify){
        return_data.error=false
        return_data.message = "DPARTNER_NOT_VERIFIED";
        return_data.data = user;
        return return_data;
      }

      return_data.error = false;
      return_data.message = "DPARTNER_EXISTS";
      return_data.data = user;
      return return_data;
    } catch (error) {
      return_data.message = "DATABASE_ERROR_FETCHING_DPARTNER";
      return return_data;
    }
  }

  // Update last login timestamp
  async updateLastLogin(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData = {
        dpartner_last_login: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table, updateData, `WHERE dpartner_email = '${email}'`);

      if (!updateResult) {
        return_data.message = "FAILED_TO_UPDATE_LAST_LOGIN ";
        return return_data;
      }

      return_data.error = false;
      return return_data;
    } catch (error) {
      return_data.message = "FAILED_TO_UPDATE_LAST_LOGIN ";
      return return_data;
    }
  }

  //logindpartner

  async logindpartner(email: string, password: string) {
    let return_data = { error: true, message: "", data: {} as any, };
    try {
         await this.executeQuery("BEGIN");
      let dpartnerResponse: any = await this.finddpartnerByEmail(email);
      if (dpartnerResponse.error) {
        await this.executeQuery("ROLLBACK");
        return_data.message = dpartnerResponse.message;
        return return_data;

      }

      let dpartner = dpartnerResponse.data;
      const isMatch = await bcrypt.compare(password, dpartner.dpartner_password);
      if (!isMatch) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "EMAIL_PASSWORD_MATCH_ERROR";
        return return_data;
      }

      if (!dpartner.dpartner_isverify) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "DPARTNER_NOT_VERIFIED";
        return return_data;
      }

      const updateLastLoginResponse: any = await this.updateLastLogin(email);
      if (updateLastLoginResponse.error) {
        await this.executeQuery("ROLLBACK");
        return_data.message = updateLastLoginResponse.message;
        return return_data;
      } 
      console.log("dpartner.dpartner_socketid",dpartner)
    
      let updatesocketid :any = await this.updateDpartnerSocketId(dpartner.id, dpartner. dpartner_socketid);
      if (updatesocketid.error) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "CUSTOMER_LOGIN_ERROR";
        return return_data;
      }
  
      let SocketId = updatesocketid.data;
      console.log("SocketId",SocketId)
      await this.executeQuery("COMMIT");
      return_data.error = false;
      return_data.message = "DPARTNER_LOGIN_SUCCESS";
      return_data.data = {dpartner: dpartner, SocketId: SocketId };

      return return_data;

    } catch (error) {
      return_data.message = "DPARTNER_LOGIN_ERROR";
      return return_data;
    }
  }

  // Update reset token
  async updateResetToken(email: string, resetToken: string | null, resetTokenExpiry: string | null) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let updateData: any = {
        dpartner_resettoken: resetToken ?? null,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      if (resetTokenExpiry === null || resetTokenExpiry === "") {
        updateData.dpartner_resettoken_expiry = null;
      } else {
        updateData.dpartner_resettoken_expiry = resetTokenExpiry;
      }

      let updateResult = await this.update(this.table, updateData, `WHERE dpartner_email = '${email}'`);

      if (!updateResult) {
        return_data.message = "FAILED_TO_UPDATE_RESETTOKEN ";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Updated reset token";
      return return_data;
    } catch (error) {
      return_data.message = "FAILED_TO_UPDATE_RESETTOKEN ";
      return return_data;
    }
  }

  // Update password
  async updatePassword(email: string, password: string,resetToken: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
          const dpartner: any = await this.finddpartnerByEmail(email);
          if (dpartner.error || !dpartner.data) {
            return_data.message = dpartner.message;
            return  return_data
          }
      
          const { dpartner_resettoken, dpartner_resettoken_expiry } = dpartner.data;
          if (!dpartner_resettoken || resetToken !== dpartner_resettoken) {
            return_data.message = "TOKEN_INVALID";
            return  return_data;
          }
      
          let expiryTime = new Date(dpartner_resettoken_expiry + " UTC");
          const currentTime = new Date();
          if (currentTime > expiryTime) {
            return_data.message ="TOKEN_EXPIRED";
            return  return_data;
          }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      let updateData = {
        dpartner_password: hashedPassword,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table, updateData, `WHERE dpartner_email = '${email}'`);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "ERROR_UPDATING_PASSWORD";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "PASSWORD_UPDATED_SUCCESSFULLY";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_UPDATING_PASSWORD";
      return return_data;
    }
  }

  // forgotpassword dpartner
  async dpartnerforgotPassword(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      let mailService = new MailService();
      let dpartner: any = await this.finddpartnerByEmail(email);
      if (dpartner.error) {
        return_data.message = dpartner.message;
        return return_data;
      }

      const resetToken = jwt.sign({ reset: true } as object, process.env.JWT_SECRET as string, { expiresIn: "10m" });
      const resetTokenExpiry = new Date(Date.now() + 10 * 60000).toISOString().replace("T", " ").slice(0, -1);
      const updateToken: any = await this.updateResetToken(email, resetToken, resetTokenExpiry);
      if (updateToken.error) {
        return_data.message = updateToken.message;
        return return_data;
      }

      let resetLink = `http://localhost:4200/dpartner/reset-password?token=${resetToken}&email=${email}`;
      await mailService.sendResetLink(email, resetLink);

      return_data.error = false;
      return_data.message = "RESET_PASSWORD_MAIL_SENT";
      return_data.data = { email: email , resetLink: resetLink,resetToken: resetToken };
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_FORGOT_PASSWORD";
      return return_data;
    }
  }

  // Get all dpartners
  async getAlldpartner() {
    let return_data = {
      error: true,
      message: "",
      data: { result: new Array() },
    };

    try {
      this.where = "WHERE dpartner_is_deleted= false";
      let dpartners = await this.allRecords("*");

      if (!dpartners || dpartners.length === 0) {
        return_data.message = "NO_ACTIVE_DPARTNERS_FOUND";
      }
      return_data.error = false;
      return_data.data = dpartners;
      return_data.message = "RETRIEVED_ALL_DPARTNERS_SUCCESSFULLY";
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_FETCHING_DPARTNERS";
      return return_data;
    }
  }

  // Update profile
  async updatedpartnerProfile(id: number, dpartner_name: string,  dpartner_licence_number:string ,dpartner_phone: string,city_name:string,vehicletype_type:string,vehicle_number:string,vehicle_name:string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      
      let city_id: any = await this.citymodel.getCityIdByCityName(city_name);
      console.log("city_id",city_id);
      if (city_id.error) {
        return_data.message = city_id.message;
        return return_data;
      }
     
      let updateData = {
        dpartner_name: dpartner_name,
        dpartner_phone: dpartner_phone,
        dpartner_city_id: city_id.data,
        dpartner_licence_number: dpartner_licence_number,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table, updateData, `WHERE id = ${id} AND dpartner_is_deleted = false`);
      console.log("updateResult",updateResult);
      let vehicleType_id: any = await this.vehicletypemodel.getVehicleTypeIdByName(vehicletype_type);
      if (vehicleType_id.error) {
        return_data.message = vehicleType_id.message;
        return return_data;
      }
     
      let updatevehicledata = {
        vehicle_name: vehicle_name,
        vehicle_number: vehicle_number,
        vehicletype_id: vehicleType_id.data,
        vehicle_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
       }
       let  vehicleupdateResult= await this.vehiclemodel.updateRecord(id,updatevehicledata);
       console.log("vehicleupdateResult",vehicleupdateResult);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "ERROR_UPDATING_PROFILE";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "PROFILE_UPDATED_SUCCESSFULLY";
      return_data.data = updateResult;
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_UPDATING_PROFILE";
      return return_data;
    }
  }

  // Find dpartner by id
  async finddpartnerById(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      let dpartnerResult = await this.selectRecord(id, "*");


      if (!dpartnerResult || dpartnerResult.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "DPARTNER_PROFILE_RETRIEVED_SUCCESSFULLY";
      return_data.data = dpartnerResult[0];
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_FETCHING_DPARTNER_PROFILE";
      return return_data;
    }
  }

  // Delete dpartner
  async deletedpartnerProfile(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      await this.executeQuery("BEGIN");

      const existingDpartner = await this.select(this.table, "*", `WHERE id = '${id}' AND dpartner_is_deleted = false`, "", "");

      if (existingDpartner.length === 0) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "ERROR_FETCHING_DPARTNER_PROFILE ";
        return return_data;
      }

      const updateData = {
        dpartner_is_deleted: true,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      const dpartnerResult = await this.updateRecord(id, updateData);

      if (!dpartnerResult) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "FAILED_TO_DELETE_DPARTNER";
        return return_data;
      }

      const vehicleDeleteResult = await this.vehiclemodel.softDeleteVehiclesByDpartnerId(id);

      if (vehicleDeleteResult.error) {
        await this.executeQuery("ROLLBACK");
        return_data.message = vehicleDeleteResult.message;
        return return_data;
      }

      await this.executeQuery("COMMIT");

      return_data.error = false;
      return_data.message = "Delivery partner and associated vehicles deleted successfully.";
      return_data.data = dpartnerResult;
      return return_data;
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "ERROR_DELETING_DPARTNER";
      return return_data;
    }
  }

  // Get available delivery partners
  async getAvailableDPartners() {
    const return_data = { error: true, message: "", data: [] as any[] };

    try {
      this.where = "WHERE dpartner_isavailable = true AND dpartner_is_deleted = false";
      const dpartners = await this.allRecords("*");

      if (!dpartners) {
        return_data.message = "FAILED_TO_UPDATE_AVAILABILITY";
        return return_data;
      }
      return_data.error = false;
      return_data.data = dpartners;
      return_data.message = "RETRIEVED_ALL_AVAILABLE_DPARTNERS";
      return return_data;
    } catch (error) {
      return_data.message = "ERROR_FETCHING_AVAILABLE_DPARTNERS";
      return return_data;
    }
  }

  // Update availability of delivery partners
  async setdPartnerAvailable(dpartnerId: number, isavailable: boolean) {
    const return_data = { error: true, message: "", data: {} as any };

    try {
      await this.executeQuery("BEGIN");
      let data = {
        dpartner_isavailable: isavailable,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      const result = await this.updateRecord(dpartnerId, data);
      // console.log("r",result)

      if (!result) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "FAILED_TO_UPDATE_AVAILABILITY";
        return return_data;
      }
      await this.executeQuery("COMMIT");

      return_data.error = false;
      return_data.data ={ result,data} ;
      return_data.message = "AVAILABILITY_UPDATED_SUCCESSFULLY";
      return return_data;
    } catch (error) {
      return_data.message = "FAILED_TO_UPDATE_AVAILABILITY";
      await this.executeQuery("ROLLBACK");
      return return_data;
    }
  }

  // Check availability of delivery partners
  async checkDpartnerAvailability(dpartnerId: number) {
    const return_data = {
      error: true,
      message: "Delivery partner not found.",
      data: { isAvailable: false } as any,
    };

    try {
      const result = await this.selectRecord(dpartnerId, "dpartner_isavailable");

      if (result && result.length > 0) {
        const isAvailable = result[0].dpartner_isavailable;

        return_data.error = false;
        return_data.data.isAvailable = isAvailable;
        return_data.message = isAvailable ? "Delivery partner is available." : "Delivery partner is not available.";
      }
    } catch (error) {
      return_data.message = "Error checking delivery partner availability.";
    }

    return return_data;
  }

  // Get dpartner by email

  async getDpartnerProfile(id: number) {
    const return_data = { error: true, message: "", data: {} as any };

    try {
  this.where = ` d LEFT JOIN vehicles v ON d.id = v.dpartner_id LEFT JOIN vehicletypes vt ON v.vehicletype_id = vt.id  LEFT JOIN cities c  ON c.id=d.dpartner_city_id WHERE d.id=${id} AND d.dpartner_is_deleted = false `;
  
  const selectField = `d.id, d.dpartner_name, d.dpartner_email, d.dpartner_phone, d.dpartner_licence_number, d.dpartner_city_id,v.vehicle_name, v.vehicle_number, v.vehicletype_id,vt.vehicletype_type ,c.city_name`;
  
  const result = await this.allRecords(selectField);
 
      if (result && result.length > 0) {
        return_data.error = false;
        return_data.data = result[0];
        return_data.message = "Delivery partner foun";
      } else {
        return_data.message = "Delivery partner not foun";
      }
    } catch (error) {
      return_data.message = "Error fetching delivery partner.";
    }

    return return_data;
  }

  //update socket id 
  async updateDpartnerSocketId(id: number, socketId: string) {
    const return_data = { error: true, message: "", data: {} as any };
    try {
      console.log("Socket id",socketId)
       let updatedata={
          dpartner_socketid: socketId,
          dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
         
       }
      const result = await this.updateRecord(id, updatedata);
      console.log("r",result)
      if (!result) {
        return_data.message = "Failed to update socket ID.";
        return return_data;
      }
      return_data.error = false;
      return_data.message = "Socket ID updated successfully.";
      return_data.data = result;
      return return_data;
      
    } catch (error) {
      console.error(" Error updating socket ID:", error);
      return { error: true, message: error };
    }
  }

  async removeSocketId(id: number) {
    let return_data = { error: true, message: "" ,data:{} as any};
    try {
       let updatedata={
          dpartner_socketid: null,
          dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
       }
      const result = await this.updateRecord(id,updatedata);
      if(!result){
        return_data.message = "Failed to remove socket ID.";
        return return_data;
      }
      return_data.error = false;  
      return_data.message = "Socket ID removed successfully.";
      return_data.data = updatedata;
      return return_data;
       
      
    } catch (error) {
      console.error(" Error removing socket ID:", error);
      return { error: true, message: error };
    }
  }

  async getActiveDPartners() {
    let return_data = { error: true, message: "", data: {result: new Array()}};
    try {
       this.where = "WHERE dpartner_isavailable = true AND dpartner_is_deleted = false";
      const result = await this.allRecords("*");
      console.log("resultt",result)
      if (!result) {
        return_data.message = "Failed to fetch active delivery partners.";
        return return_data;
       
      }
      return_data.error = false;
      return_data.data = result;
      return_data.message = "Active delivery partners fetched successfully.";
      return return_data;
     
    } catch (error) {
      console.error(" Error fetching active delivery partners:", error);
      return { error: true, message: error };
    }
  }
  async getDpartnerBySocketId(socketId: string) {
    let return_data = { error: true, message: "", data: {} as any };
    try {
      this.where = `WHERE dpartner_socketid = '${socketId}' AND dpartner_is_deleted = false`;
      const result = await this.allRecords("*");

      if (result.length === 0) {
        return_data.message = "DPARTNER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "DPARTNER_EXISTS";
      return_data.data = result[0];
      return return_data;
    } catch (error) {
      return_data.message = "DATABASE_ERROR_FETCHING_DPARTNER";
      return return_data;
    }
  }

}