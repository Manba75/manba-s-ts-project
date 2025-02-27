import { appdb } from "./appdb";
import { MailService } from "../library/sendMail";
import { number } from "joi";
import { generateOTP } from "../library/generateOTP";
import { dbVehicles } from "./vehiclemodel";
import { dbCity } from "./citymodel";
import { dbVehicleType } from "./vehicletypemodel";
export class dbDpartners extends appdb {
  vehiclemodel: dbVehicles; 
constructor() {
    super();
    this.table = "deliverypartners";
    this.uniqueField = "id";
    this.vehiclemodel = new dbVehicles();
    
  }

// check email
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
        return_data.message = "dpartner not found";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "login successfully";
      return_data.data = result[0];
      return return_data;
    } catch (error) {
      console.error("Database Query Error:", error);
      return_data.message = "Database error while fetching dpartner";
      return return_data;
    }
  }

//signup
  
async insertDpartner(city_id: number, vehicletype_id: number, dpartner_email: string, dpartner_pass: string, dpartner_created_ip: string, dpartner_licence: string, dpartner_phone: string, vehicle_number: string, vehicle_name: string, otp: number) {
    let return_data = { error: true, message: "", data: {} };
    try {
      await this.executeQuery("BEGIN");

      this.where = `WHERE dpartner_email = '${dpartner_email}'`;
      const existingDpartner = await this.allRecords("*");
      let dpartner_id: number;
      let dpartnerResult;

      if (existingDpartner.length > 0) {
        const dpartner = existingDpartner[0];
        if (dpartner.dpartner_is_deleted) {
          const updateData = {
            dpartner_password: dpartner_pass,
            dpartner_phone,
            dpartner_city_id: city_id,
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
            return_data.message = "Failed to reactivate delivery partner.";
            return return_data;
          }
          dpartner_id = dpartner.id;
        } else {
          return_data.message = "email  is already exists";
            return return_data;
        }
      } else {
        const insertData = {
          dpartner_email,
          dpartner_password: dpartner_pass,
          dpartner_phone,
          dpartner_city_id: city_id,
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
          return_data.message = "Delivery partner could not be created.";
            return return_data;
        }
          
        dpartner_id = dpartnerResult;
      }
      
      const vehicleResult = await this.vehiclemodel.insertOrUpdateVehicle(dpartner_id, vehicletype_id, vehicle_number, vehicle_name, dpartner_created_ip);
      if (vehicleResult.error) {
        return_data.message = "vehucle could not be created.";
        return return_data;
      }
      
      await this.executeQuery("COMMIT");
      return_data.error = false;
      return_data.message = "Delivery partner and vehicle created successfully";
      return_data.data ={dpartnerResult,vehicle:vehicleResult.data}
      return return_data;
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      return_data.message =" Database error ";
      return return_data;
    }
   
  }

// verify dpartner oTP
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
        return_data.message = "delivery partner not found.";
        return return_data;
      }

      let dpartner = existingdpartner[0];

  
      if (dpartner.dpartner_verifyotp !== otp) {
        return_data.message = "Invalid OTP.";
        return return_data;
      }

      let storedExpiryTime = new Date(dpartner.dpartner_expiryotp + " UTC"); // Force UTC interpretation
      let currentTime = new Date(); 

      if (currentTime > storedExpiryTime) {
        return_data.message = "OTP has expired.";
        return return_data;
      }

   
      let updateData = {
        dpartner_isverify: true,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

 
      let updateResult = await this.updateRecord(dpartner.id, updateData);
     
      if (!updateResult) {
        return_data.message = "Error updating dpartner verification status.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "dpartner verified successfully.";
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
        return_data.message = "dpartner not found.";
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
        return_data.message = "not update otp.";
        return return_data;
      } 
      let mailService = new MailService();
      await mailService.sendOTPMail(email, newOTP);

      return_data.error = false;
      return_data.message = "OTP resent successfully. Please check your email.";
      return return_data;
      
    } catch (error) {
      console.error("Error resending OTP:", error);
      return_data.error = true;
      return_data.message = "Error while resending OTP.";
      return return_data;
    }
  }

  //login and finding dpartner
  
async finddpartnerByEmail(email: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      this.where = `WHERE  dpartner_email = '${email}' AND dpartner_is_deleted=false`;
      let result = await this.allRecords("*");

      if (result.length === 0) {
        return_data.message = "dpartner not found";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "login successfully";
      return_data.data = result[0];
      return return_data;
    } catch (error) {
      console.error("Database Query Error:", error);
      return_data.message = "Database error while fetching dpartner";
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
        dpartner_last_login: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table,updateData,`WHERE  dpartner_email = '${email}'`);

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
async updateResetToken( email: string, resetToken: string | null,resetTokenExpiry: string | null) {
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

      console.log("Final updateData before query:", updateData);
      let updateResult = await this.update( this.table,updateData,`WHERE  dpartner_email = '${email}'` );

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
        dpartner_password: password,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table,updateData,`WHERE  dpartner_email = '${email}'`);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "dpartner not found or password update failed.";
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

// get all dpartners
async getAlldpartner() {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
     
      this.where = "WHERE dpartner_is_deleted= false";
      let dpartners = await this.allRecords("*");

      if (!dpartners || dpartners.length === 0) {
        return_data.message = "No active dpartners found.";
      } 
      return_data.error = false;
      return_data.data = dpartners;
      return_data.message ="Retrieved all active dpartner data successfully.";
      return return_data;
      
    } catch (error) {
      console.error("Error fetching dpartners from database:", error);
      return_data.message = "Error fetching dpartner data.";
      return return_data;
    }

    
  }

//update profile
async updatedpartnerProfile(id: number, name: string, phone: string) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
      let updateData = {
        dpartner_name: name,
        dpartner_phone: phone,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.update(this.table,updateData,`WHERE id = ${id} AND dpartner_is_deleted = false`);

      if (!updateResult || updateResult.rowCount === 0) {
        return_data.message = "dpartner not found or profile update failed.";
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

// find dpartner by id
async finddpartnerById(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
     
      let dpartnerResult = await this.selectRecord(id, "*");

      if (!dpartnerResult || dpartnerResult.length === 0) {
        return_data.message = "dpartner not found.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "dpartner profile retrieved successfully.";
      return_data.data = dpartnerResult[0]; 
      return return_data;
    } catch (error) {
      console.error("Database Fetch Error:", error);
      return_data.message = "Error fetching dpartner profile.";
      return return_data;
    }
  }

// delete dpartner
async deletedpartnerProfile(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {} as any,
    };

    try {
     
      await this.executeQuery("BEGIN");

      const existingDpartner = await this.select(this.table,"*",`WHERE id = '${id}' AND dpartner_is_deleted = false`,"","");

      if (existingDpartner.length === 0) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "Delivery partner not found or already deleted.";
        return return_data;
      }

      const updateData = {
        dpartner_is_deleted: true,
        dpartner_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      const dpartnerResult = await this.updateRecord(id,updateData)
    

      if (!dpartnerResult) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "Failed to delete delivery partner.";
        return return_data;
      }

      const vehicleDeleteResult = await this.vehiclemodel.softDeleteVehiclesByDpartnerId(id);

      if (vehicleDeleteResult.error) {
        await this.executeQuery("ROLLBACK");
        return_data.message = vehicleDeleteResult.message;
        return return_data;
      }
      

     
      await this.executeQuery("COMMIT")
     
      return_data.error = false;
      return_data.message = "Delivery partner and associated vehicles deleted successfully."
      return_data.data = dpartnerResult;
      return return_data;
    } catch (error) {
   
      await this.executeQuery("ROLLBACK");
      console.error("Error deleting delivery partner profile:", error);
      return_data.message = "Error deleting delivery partner profile.";
      return return_data;
    }
}

//get available delivery partners

async getAvailableDPartners() {
    const return_data = {error: true,message: "", data: [] as any[], };

    try {
      this.where ="WHERE dpartner_isavailable = true AND dpartner_is_deleted = false";
      const dpartners = await this.allRecords("*");

      if (!dpartners) {
        return_data.message = " No available delivery partners found.";
       return return_data;
      }
       return_data.error = false;
       return_data.data = dpartners;
       return_data.message ="Retrieved all available delivery partners successfully.";
       return return_data;
    } catch (error) {
      console.error("Error fetching available delivery partners:", error);
      return_data.message = "Error fetching available delivery partners.";
    }

    
  }

//update availabilty delivery partners
async setdPartnerAvailable(dpartnerId: number, isAvailable: boolean) {
    const return_data = {error: true,  message: "",  data: {} as any,};

    try {
      await this.executeQuery("BEGIN");
      const data = {
        dpartner_isavailable: isAvailable,
        dpartner_updated_on: new Date().toISOString().replace("T"," ").slice(0, -1),
      };

      const result = await this.updateRecord(dpartnerId, data);

      if (!result) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "Failed to update delivery partner availability.";
        return return_data;
      } 
      await this.executeQuery("COMMIT");

      return_data.error = false;
      return_data.data = result;
      return_data.message = "Delivery partner availability updated successfully.";
      return return_data;
    } catch (error) {
      console.error("Error setting delivery partner availability:", error);
      return_data.message = "Error setting delivery partner availability.";
      await this.executeQuery("ROLLBACK");
    }

    
 }

//check available delivery partners
async checkDpartnerAvailability(dpartnerId: number) {
    const return_data = {
      error: true,
      message: "Delivery partner not found.",
      data: { isAvailable: false } as any,
    };

    try {
      const result = await this.selectRecord(
        dpartnerId,
        "dpartner_isavailable"
      );

      if (result && result.length > 0) {
        const isAvailable = result[0].dpartner_isavailable;

        return_data.error = false;
        return_data.data.isAvailable = isAvailable;
        return_data.message = isAvailable ? "Delivery partner is available."  : "Delivery partner is not available.";
      }
    } catch (error) {
      console.error("Error checking delivery partner availability:", error);
      return_data.message = "Error checking delivery partner availability.";
    }

    return return_data;
  }
}
