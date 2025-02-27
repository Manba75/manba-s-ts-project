import { dbaddress } from "./addressmodel";
import { appdb } from "./appdb";
import { dbCity } from "./citymodel";

// var this.citymodel = new dbCity();

export class dborders extends appdb {
  addressmodel:dbaddress;
  citymodel:dbCity;
  constructor() {
    super();
    this.table = "orders";
    this.uniqueField = "id";
    this.addressmodel=new dbaddress();
    this.citymodel=new dbCity();
  }

async orderPlace(
    cust_id: number,
    vehicletype: number,
    pickup: any,
    drop: any,
    order_charge: number,
    createdIp: string
  ) {
    const return_data = {
      error: true,
      message: "",
      data: null,
    };

    await this.executeQuery("BEGIN"); // Start Transaction

    // Get City Details
    const cityDetailsResponse = await this.citymodel.getCityDetails(
      pickup.city,
      drop.city
    );

    if (cityDetailsResponse.error ) {
      await this.executeQuery("ROLLBACK");
      return_data.message =
        cityDetailsResponse.message || "City details not found";
      return return_data;
    }

    const pickupCityDetails:any = cityDetailsResponse.data?.pickupCityDetails;
    const dropCityDetails :any= cityDetailsResponse.data?.dropCityDetails;

    // Check or Insert Pickup Address
    let pickupResponse = await this.addressmodel.getExistingAddress(
      cust_id,
      pickupCityDetails.id,
      pickup,
      "pickup"
    );
    console.log("Drop Address Response:", pickupResponse);
    let pickup_id = pickupResponse.data; // Extracting ID if exists

    if (!pickup_id) {
      const insertPickup = await this.addressmodel.insertAddress(pickupCityDetails.id,cust_id,pickup,"pickup",createdIp);

      if (insertPickup.error) {
        await this.executeQuery("ROLLBACK");
        return insertPickup;
      }

      pickup_id = insertPickup.data; 
    }

    // Check or Insert Drop Address
    let dropResponse = await this.addressmodel.getExistingAddress(cust_id, dropCityDetails.id,drop,"drop");
    console.log("Drop Address Response:", dropResponse);
    let drop_id = dropResponse.data; 
    if (!drop_id) {
      const insertDrop = await this.addressmodel.insertAddress(dropCityDetails.id,cust_id,drop,"drop",createdIp);

      if (insertDrop.error) {
        await this.executeQuery("ROLLBACK");
        return insertDrop;
      }

      drop_id = insertDrop.data; 
      console.log(drop_id)
    }

    
    const orderData = {
      cust_id,
      pickup_address_id: pickup_id,
      drop_address_id: drop_id,
      vehicle_type_id: vehicletype,
      order_date: new Date().toISOString().replace("T", " ").slice(0, -1),
      order_status: "pending",
      order_delivery_charge: order_charge,
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

    // Insert Order
    const insertResult = await this.insertRecord(orderData);
    if (!insertResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "Failed to create order";
      return return_data;
    }

    await this.executeQuery("COMMIT"); 

    return_data.error = false;
    return_data.message = "Order placed successfully";
    return_data.data = insertResult;
    return return_data;
  }

//get order by id
async getOrderById(orderId: number) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let orderResult = await this.select(
      this.table,
      "*",
      `WHERE id = '${orderId}' AND is_deleted=false`,
      "",
      ""
    );
    // console.log('order',orderResult)

    if (orderResult.length === 0) {
      return_data.message = `No order found with ID ${orderId}`;
      return return_data;
    } else {
      return_data.error = false;
      return_data.message = "order retrived successfully";
      return_data.data = orderResult[0];
      return return_data;
    }
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error fetching city by ID.";
  }
}

async assignDeliveryPartner(orderId: number, dpartnerId: number) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let updateData = {
      dpartner_id: dpartnerId,
      order_status: "accepted",
    };
    let updatedResult = await this.updateRecord(orderId,updateData);
      

    if (updatedResult.length === 0) {
      return_data.message = `No order accept any  delivery partners`;
      return return_data;
    } 
      return_data.error = false;
      return_data.message = "order accepted successfully";
      return_data.data = updatedResult;
      return return_data;
    
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error assign delivery partners.";
  }
}

async updateOrderStatus(orderId: number, status: string, dpartnerId: number) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let updateData = {
      order_status: status,
      dpartner_id: dpartnerId,
    };
    let updatedResult = await this.updateRecord(orderId, updateData);

    if (updatedResult.length === 0) {
      return_data.message = `No order  status delivery partners`;
      return return_data;
    } else {
      return_data.error = false;
      return_data.message = "order status changes successfully";
      return_data.data = updatedResult;
      return return_data;
    }
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error assign delivery partners.";
  }
}
// update orderOtp
async updateOrderOTP(orderId: number, otp: number, otpExpiry: string) {
  let return_data = {
    error: true,
    message: "",
    data: {},
  };

  try {
    let updateData = {
      order_verifyotp: Number(otp),
      order_expiryotp: otpExpiry,
      order_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
    };
  
    let updateResult = await this.updateRecord(orderId, updateData);
    if (!updateResult) {
      return_data.message = "not update otp.";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "OTP resent successfully. Please check your email.";
    return_data.data = updateResult[0];
    return return_data;
  } catch (error) {
    console.error("Error resending OTP:", error);
    return_data.error = true;
    return_data.message = "Error while resending OTP.";
    return return_data;
  }
}

// get socket id of customer

async getCustomerOrders(customerId: number) {
  const return_data = {
    error: true,
    message: "",
    data: null,
  };

  try {
    // Fetch orders for the given customer
    const orders = await this.select(this.table, "*",`WHERE cust_id = ${customerId} AND is_deleted = false`,"","ORDER BY order_created_on DESC");

    if (!orders || orders.length === 0) {
      return_data.message = "No orders found for this customer.";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "Orders retrieved successfully.";
    return_data.data = orders;
  } catch (error) {
    return_data.message = "Error fetching orders.";
  }

  return return_data;
}
async getAllOrders() {
  const return_data = {
    error: true,
    message: "",
    data: { result:new Array()},
  };

  try {
    this.where= "WHERE is_deleted = false";
    let orders = await this.allRecords("*");

    if (!orders || orders.length === 0) {
      return_data.message = "No orders found.";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "All orders retrieved successfully.";
    return_data.data = orders;
  } catch (error) {
    return_data.message = "Error fetching all orders.";
  }

  return return_data;
}
}
