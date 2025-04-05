import { dbaddress } from "./addressmodel";
import { appdb } from "./appdb";
import { dbCity } from "./citymodel";
import { VehicletypeService } from '../../../../finalfrontend/src/app/services/vehicletype.service';
import { dbVehicleType } from "./vehicletypemodel";
import { generateOTP } from "../library/generateOTP";
import { get } from "http";
import { dbcustomers } from "./customermodel";
import { dbDpartners } from "./dpartnersmodel";
import { MailService } from "../library/sendMail";

export class dborders extends appdb {
  addressmodel: dbaddress;
  citymodel: dbCity;
  vehiclemodel: dbVehicleType;
  customnermodel:  dbcustomers;
  dpartnermodel:dbDpartners;

  constructor() {
    super();
    this.table = "orders";
    this.uniqueField = "id";
    this.addressmodel = new dbaddress();
    this.citymodel = new dbCity();
    this.vehiclemodel = new dbVehicleType();
    this.customnermodel = new dbcustomers();
    this.dpartnermodel = new dbDpartners();
  }

  async orderPlace(cust_id: number, vehicletype: string, pickup: any, drop: any, createdIp: string) {
    const return_data = { error: true, message: "", data: {} };

    await this.executeQuery("BEGIN");

    const cityDetailsResponse = await this.citymodel.getCityDetails(pickup.city, drop.city);

    if (cityDetailsResponse.error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = cityDetailsResponse.message || "City details not found";
      return return_data;
    }
    let vehicletypes: any = await this.vehiclemodel.getVehicleTypeIdByName(vehicletype);

    if (vehicletypes.error || !vehicletypes.data) {
      await this.executeQuery("ROLLBACK");
      return_data.message = vehicletypes.message || "Vehicle type not found";
      return return_data;
    }
    let order_Charge = vehicletypes.data.vehicletype_price;
    let vehicletype_id = vehicletypes.data.id;
    let pickupCityDetails: any = cityDetailsResponse.data?.pickupCityDetails;
    let dropCityDetails: any = cityDetailsResponse.data?.dropCityDetails;
    console.log("pickupCityDetails", pickupCityDetails);
    console.log("dropCityDetails", dropCityDetails);
    let pickupResponse = await this.addressmodel.getExistingAddress(cust_id, pickupCityDetails.id, pickup, "pickup");
    let pickup_id = pickupResponse.data.id;

    if (!pickup_id) {
      const insertPickup = await this.addressmodel.insertAddress(pickupCityDetails.id, cust_id, pickup, "pickup", createdIp);
      if (insertPickup.error) {
        await this.executeQuery("ROLLBACK");
        return insertPickup;
      }
      pickup_id = insertPickup.data;
    }

    let dropResponse = await this.addressmodel.getExistingAddress(cust_id, dropCityDetails.id, drop, "drop");
    let drop_id = dropResponse.data.id;

    if (!drop_id) {
      const insertDrop = await this.addressmodel.insertAddress(dropCityDetails.id, cust_id, drop, "drop", createdIp);
      if (insertDrop.error) {
        await this.executeQuery("ROLLBACK");
        return insertDrop;
      }
      drop_id = insertDrop.data;
    }

    const orderData = {
      cust_id,
      pickup_address_id: pickup_id,
      drop_address_id: drop_id,
      vehicle_type_id: vehicletype_id,
      order_date: new Date().toISOString().replace("T", " ").slice(0, -1),
      order_status: "pending",
      order_delivery_charge: order_Charge || "100",
      order_pickup_flatno: pickup.flatno,
      order_pickup_street: pickup.street,
      order_pickup_landmark: pickup.landmark,
      order_pickup_pincode: pickup.pincode,
      order_pickup_phone: pickup.phone,
      order_pickup_city: pickup.city,
      order_pickup_state: pickup.state,
      order_pickup_latitude: pickup.latitude,
      order_pickup_longitude: pickup.longitude,
      order_drop_flatno: drop.flatno,
      order_drop_street: drop.street,
      order_drop_landmark: drop.landmark,
      order_drop_pincode: drop.pincode,
      order_drop_phone: drop.phone,
      order_drop_city: drop.city,
      order_drop_state: drop.state,
      order_drop_latitude: drop.latitude,
      order_drop_longitude: drop.longitude,
      order_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      order_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      order_created_ip: createdIp,
    };

    const insertResult = await this.insertRecord(orderData);
    if (!insertResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "ORDER_INSERT_ERROR";
      return return_data;
    }
    
    //  insertResult;
    // this.where=`o LEFT JOIN customers c ON o.cust_id = c.id `;
    // this.where += ` o.is_deleted = false AND c.is_deleted = false AND d.dpartner_is_deleted = false`;
    // // const orderDetails = await this.selectRecord(orderId,`o.id, o.cust_id, o.dpartner_id, o.order_status, o.order_delivery_charge, o.order_date, d.  c.cust_name , c.cust_phone`);
    // if (!orderDetails || orderDetails.length === 0) {
    
    //   return_data.message = "ORDER_NOT_FOUND";
    //   return return_data;
    // }
    await this.executeQuery("COMMIT");
  

    return_data.error = false;
    return_data.message = "ORDER_INSERT_SUCCESS";
    return_data.data = {insertResult,orderData}
    return return_data;
  }

  //order get
  async getOrderById(orderId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let orderResult = await this.select(this.table, "*", `WHERE id = '${orderId}' AND is_deleted=false`, "", "");

      if (orderResult.length === 0) {
        return_data.message = "ORDER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "ORDER_FETCH_SUCCESS";
      return_data.data = orderResult[0];
      return return_data;
    } catch (error) {
      return_data.message = "ORDER_FETCH_ERROR";
      return return_data;
    }
  }

  async assignDeliveryPartner(orderId: number, dpartnerId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let updateData = { dpartner_id: dpartnerId, order_status: "accepted" };
      let updatedResult = await this.updateRecord(orderId, updateData);


      if (!updatedResult) {
        return_data.message = "ORDER_ASSIGN_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "ORDER_ACCEPT_SUCCESS";
      return_data.data = updatedResult;
      return return_data;
    } catch (error) {
      return_data.message = "ORDER_ASSIGN_ERROR";
      return return_data;
    }
  }

 
  async acceptOrder(orderId: number, dpartnerId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
        // Update Order Status to "Accepted" and Assign Delivery Partner
        let updateData = { order_status: "accepted", dpartner_id: dpartnerId };
        let updatedResult = await this.updateRecord(orderId, updateData);

        if (!updatedResult) {
            return_data.message = "ORDER_ACCEPT_ERROR";
            return return_data;
        }

      
        let order :any = await this.getOrderById(orderId);
        if (order.error || !order.data) {
            return_data.message = "ORDER_NOT_FOUND";
            return return_data;
        }

        let customerResponse = await this.customnermodel.findUserById(order.data.cust_id);
        if (customerResponse.error || !customerResponse.data) {
            return_data.message = "CUSTOMER_NOT_FOUND";
            return return_data;
        }

        const customer = customerResponse.data;
        
    
        const otp :number = generateOTP();
        const otpExpiry = new Date(Date.now() + 60 * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, -1);

        const otpUpdateResult = await this.updateOrderOTP(orderId, otp, otpExpiry);
        if (otpUpdateResult.error) {
            return_data.message = "OTP_UPDATE_FAILED";
            return return_data;
        }

        // Set Delivery Partner as Unavailable
        const dpartnerAvailable = await this.dpartnermodel.setdPartnerAvailable(dpartnerId, false);
        if (dpartnerAvailable.error) {
            return_data.message = "DPARTNER_AVAILABILITY_UPDATE_FAILED";
            return return_data;
        }
        // console.log("custide", order.data.cust_id);
        // Send OTP Email to Customer
        let mailService = new MailService();
        await mailService.sendOrderOTPMail(orderId, customer.cust_email, otp);
        // let data={
        //   orderId: orderId,
        //   updateData,
        // //  cust_id: 
      
        // }
        return_data.error = false;
        return_data.message = "ORDER_ACCEPT_SUCCESS";
        return_data.data = {updateData, orderId, otp};
        return return_data;
    } catch (error) {
        console.error("ORDER_ACCEPT_ERROR:", error);
        return_data.message = "ORDER_ACCEPT_ERROR";
        return return_data;
    }
}

  

  async updateOrderStatus(orderId: number, status: string, dpartnerId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let updateData = { order_status: status, dpartner_id: dpartnerId };
      let updatedResult = await this.updateRecord(orderId, updateData);

      if (!updatedResult) {
        return_data.message = "ORDER_STATUS_UPDATE_ERROR";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "ORDER_STATUS_UPDATE_SUCCESS";
      return_data.data = updatedResult;
      return return_data;
    } catch (error) {
      return_data.message = "ORDER_STATUS_UPDATE_ERROR";
      return return_data;
    }
  }

  async updateOrderOTP(orderId: number, otp: number, otpExpiry: string) {
    let return_data = { error: true, message: "", data: {} };

    try {
      let updateData = {
        order_verifyotp: Number(otp),
        order_expiryotp: otpExpiry,
        order_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.updateRecord(orderId, updateData);
      if (!updateResult) {
        return_data.message = "Failed to update OTP.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "OTP updated successfully.";
      return_data.data = updateResult[0];
      return return_data;
    } catch (error) {
      return_data.message = "Error updating OTP.";
      return return_data;
    }
  }

  async getCustomerOrders(customerId: number) {
    const return_data = { error: true, message: "", data: null };

    try {
      this.where=`o LEFT JOIN deliverypartners d ON o.dpartner_id=d.id LEFT JOIN customers c ON o.cust_id=c.id WHERE o.is_deleted = false AND d.dpartner_is_deleted = false AND c.is_deleted = false`;
      this.where += ` AND o.cust_id = ${customerId}`;
      this.where+=`ORDER BY 
                CASE 
                    WHEN o.order_status = 'accepted' THEN 1 
                    WHEN o.order_status = 'pickup' THEN 2 
                     WHEN o.order_status = 'in-progress' THEN 3
                    WHEN o.order_status = 'delivered' THEN 4
                    ELSE 5
                END,
                o.order_date DESC`;

      const orders = await this.allRecords(`o.id, o.cust_id, o.dpartner_id, o.order_status, o.order_delivery_charge, o.order_date, d.dpartner_name, d.dpartner_phone, c.cust_name`);

      if (!orders || orders.length === 0) {
        return_data.message = "No orders found for this customer.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "ORDER_FETCH_SUCCESS";
      return_data.data = orders;
      return return_data;
    } catch (error) {
      return_data.message = "ORDER_FETCH_ERROR";
      return return_data;
    }
  }

  async getAllOrders() {
    const return_data = { error: true, message: "", data: { result: new  Array()} };

    try {
      this.where = `
         o 
        LEFT JOIN customers c ON o.cust_id = c.id 
        WHERE o.is_deleted = false AND c.is_deleted = false
      `;
      this.where += ` ORDER BY 
                CASE 
                 WHEN o.order_status = 'pending' THEN 1 
                    WHEN o.order_status = 'accepted' THEN 2
                    WHEN o.order_status = 'pickup' THEN 3
                     WHEN o.order_status = 'in-progress' THEN 4
                    WHEN o.order_status = 'delivered' THEN 5
                    ELSE 6
                END,
                o.order_date DESC`;

      let orders = await this.allRecords(`
        o.id,
        o.cust_id,
        o.dpartner_id,
        CONCAT(o.order_pickup_flatno, ', ', o.order_pickup_street, ', ', o.order_pickup_landmark, ', ', o.order_pickup_city, ', ', o.order_pickup_pincode) AS pickup_address, 
        CONCAT(o.order_drop_flatno, ', ', o.order_drop_street, ', ', o.order_drop_landmark, ', ', o.order_drop_city, ', ', o.order_drop_pincode) AS drop_address,  o.order_status,  o.order_delivery_charge, o.order_date,  c.cust_name, c.cust_phone `)

      // console.log("orders", orders);
      if (!orders || orders.length === 0) {
        return_data.message = "ORDER_NOT_FOUND";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "ORDERS_FETCH_SUCCESS";
      return_data.data = orders;
      return return_data;
    } catch (error) {
      console.error("Database Error:", error);
      return_data.message = "ORDERS_FETCH_ERROR";
      return return_data;
    }
  }
   async verifypickupOTP(orderId: number, otp: number) {
    let return_data={error:true,message:"",data:{}};
    try{
      const orderResponse: any = await this.getOrderById(orderId);
      console.log("orderResponse",orderResponse)
      const order: any = orderResponse?.data;
  
      if (orderResponse.error || order.order_verifyotp !== otp) {
        return_data.message = "Invalid OTP";
        return return_data;
      }
  
      let storedExpiryTime = new Date(order.order_expiryotp + " UTC");
      let currentTime = new Date();
      if (currentTime > storedExpiryTime) {
         return_data.message = "OTP expired";
        return return_data;
      }
      return_data.error = false;
      return_data.message = "OTP verified successfully";
      return_data.data = orderResponse.data;
      return return_data;

    }catch(error){
      console.error("Error verifying OTP:", error);
      return_data.message = "OTP verification failed";
      return return_data;

    }

  }

}