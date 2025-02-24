import { appdb } from "./appdb";
import { dbCity } from "./citymodel";

var cityObj = new dbCity();

export class dborders extends appdb {
  constructor() {
    super();
    this.table = "orders";
    this.uniqueField = "id";
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
    const cityDetailsResponse = await cityObj.getCityDetails(
      pickup.city,
      drop.city
    );

    if (
      cityDetailsResponse.error ||
      !cityDetailsResponse.pickupCityDetails ||
      !cityDetailsResponse.dropCityDetails
    ) {
      await this.executeQuery("ROLLBACK");
      return_data.message =
        cityDetailsResponse.message || "City details not found";
      return return_data;
    }

    const pickupCityDetails = cityDetailsResponse.pickupCityDetails;
    const dropCityDetails = cityDetailsResponse.dropCityDetails;

    // Check or Insert Pickup Address
    let pickupResponse = await this.getExistingAddress(
      cust_id,
      pickupCityDetails.id,
      pickup,
      "pickup"
    );
    console.log("Drop Address Response:", pickupResponse);
    let pickup_id = pickupResponse.data; // Extracting ID if exists

    if (!pickup_id) {
      const insertPickup = await this.insertAddress(
        pickupCityDetails.id,
        cust_id,
        pickup,
        "pickup",
        createdIp
      );

      if (insertPickup.error) {
        await this.executeQuery("ROLLBACK");
        return insertPickup;
      }

      pickup_id = insertPickup.data; // Newly inserted ID
    }

    // Check or Insert Drop Address
    let dropResponse = await this.getExistingAddress(
      cust_id,
      dropCityDetails.id,
      drop,
      "drop"
    );
    console.log("Drop Address Response:", dropResponse);
    let drop_id = dropResponse.data; // Extracting ID if exists

    if (!drop_id) {
      const insertDrop = await this.insertAddress(
        dropCityDetails.id,
        cust_id,
        drop,
        "drop",
        createdIp
      );

      if (insertDrop.error) {
        await this.executeQuery("ROLLBACK");
        return insertDrop;
      }

      drop_id = insertDrop.data; 
      // Newly inserted ID
      console.log(drop_id)
    }

    // Prepare Order Data
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

    await this.executeQuery("COMMIT"); // Commit if all queries succeed

    return_data.error = false;
    return_data.message = "Order placed successfully";
    return_data.data = insertResult;
    return return_data;
  }

  async getExistingAddress(
    cust_id: number,
    city_id: number,
    address: any,
    address_type: string
  ) {
    const return_data = {
      error: true,
      message: "Address lookup failed",
      data: null,
    };
 await this.executeQuery("BEGIN");
    // if (!cust_id || !city_id || !address) {
    //   return_data.message = "Missing required parameters";
    //   return return_data;
    // }

    try {
      // Sanitize inputs to avoid SQL errors
      const street = address.street ? address.street.replace(/'/g, "''") : "";
      const flatno = address.flatno ? address.flatno.replace(/'/g, "''") : "";
      const pincode = address.pincode
        ? address.pincode.replace(/'/g, "''")
        : "";
      const landmark = address.landmark
        ? address.landmark.replace(/'/g, "''")
        : "";
      const type = address_type ? address_type.replace(/'/g, "''") : "";

      this.where = `
      WHERE cust_id = ${cust_id}
        AND address_city_id = ${city_id}
        AND address_street = '${street}'
        AND address_flatno = '${flatno}'
        AND address_pincode = '${pincode}'
        AND address_landmark = '${landmark}'
        AND address_type = '${type}'
    `;

      const result = await this.select("address", "*", this.where, "", "");
      // console.log("Existing Address Query Result:", result);

      if (Array.isArray(result) && result.length > 0) {
         await this.executeQuery("COMMIT");
        return_data.error = false;
        return_data.message = "Address found";
        return_data.data = result[0].id; // Ensure result has "id" key
      }
       await this.executeQuery("ROLLBACK");
    } catch (error) {
       await this.executeQuery("ROLLBACK");
      console.error("Error in getExistingAddress:", error);
      return_data.message = "Database error occurred";
    }

    return return_data;
  }

  async insertAddress(
    city_id: number,
    cust_id: number,
    address: any,
    address_type: string,
    createdIp: string
  ) {
    const return_data = {
      error: true,
      message: "",
      data: null,
    };
     
await this.executeQuery("BEGIN");
    const addressData = {
      address_city_id: city_id,
      cust_id,
      address_type,
      address_street: address.street,
      address_flatno: address.flatno,
      address_landmark: address.landmark,
      address_pincode: address.pincode,
      address_phone: address.phone,
      address_longitude: address.longitude,
      address_latitude: address.latitude,
      address_created_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
      address_updated_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
      address_created_ip: createdIp,
    };

    const insertResult: any = await this.insert("address", addressData);
    // console.log("in", insertResult);
    if (!insertResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message="Address insertion failed"
      return return_data;
    }
 await this.executeQuery("COMMIT");
    return_data.error = false;
    return_data.message = "Address inserted successfully";
    return_data.data = insertResult;
   
    return return_data;
  }
  // update status
  // async updateOrderStatus(orderId: number, status: string, dpartnerId: number) {
  //   const return_data = {
  //     error: true,
  //     message: "",
  //     data: null,
  //   };

  //   await this.executeQuery("BEGIN"); // Start transaction

  //   // Fetch the current order status
  //   const orderResult = await this.select(
  //     "orders",
  //     "order_status",
  //     `WHERE id = ${orderId}`,
  //     "",
  //     "LIMIT 1"
  //   );

  //   if (!orderResult || orderResult.length === 0) {
  //     await this.executeQuery("ROLLBACK");
  //     return_data.message = "Order not found.";
  //     return return_data;
  //   }

  //   const currentStatus = orderResult[0].order_status;

  //   // Define locked statuses that cannot revert to previous status
  //   const lockedStatuses = ["accepted", "pickup", "in-progress", "delivered"];

  //   // Prevent reverting to "pending"
  //   if (lockedStatuses.includes(currentStatus) && status === "pending") {
  //     await this.executeQuery("ROLLBACK");
  //     return_data.message =
  //       "Once the status is updated to accepted, in-progress, or delivered, it cannot be reverted to pending.";
  //     return return_data;
  //   }

  //   // Update the order status
  //   const updateData = {
  //     order_status: status,
  //     dpartner_id: dpartnerId,
  //   };

  //   const updateResult = await this.update(
  //     "orders",
  //     updateData,
  //     `WHERE id = ${orderId}`
  //   );

  //   if (!updateResult) {
  //     await this.executeQuery("ROLLBACK");
  //     return_data.message = "Order not found or status unchanged.";
  //     return return_data;
  //   }

  //   await this.executeQuery("COMMIT"); // Commit transaction

  //   return_data.error = false;
  //   return_data.message = "Order status updated successfully.";
  //   return_data.data = await this.select(
  //     "orders",
  //     "*",
  //     `WHERE id = ${orderId}`,
  //     "",
  //     "LIMIT 1"
  //   );

  //   return return_data;
  // }

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
      let updatedResult = await this.update(
        this.table,
        updateData,
        `WHERE id = ${orderId}`
      );

      if (updatedResult.length === 0) {
        return_data.message = `No order accept any  delivery partners`;
        return return_data;
      } else {
        return_data.error = false;
        return_data.message = "order accepted successfully";
        return_data.data = updatedResult;
        return return_data;
      }
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
      let updatedResult = await this.update(
        this.table,
        updateData,
        `WHERE id = ${orderId}`
      );

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
        order_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
      };
      // console.log("u5", updateData);
      //   this.where = `WHERE cust_email = '${email}' AND is_deleted = false`;
      let updateResult = await this.updateRecord(orderId, updateData);
      // console.log("u", updateResult);
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
  async getCustomerSocketId(customerId: number) {
    let return_data = {
      error: true,
      message: " ",
      data: {},
    };

    try {
      let custResult = await this.select(
        "customers",
        "socket_id",
        `WHERE id = ${customerId}`,
        "",
        "LIMIT 1"
      );

      if (custResult.length === 0) {
        return_data.message = `No sockekt found with ID`;
        return return_data;
      } else {
        return_data.error = false;
        return_data.message = "socket retrived successfully";
        return_data.data = custResult[0];
        return return_data;
      }
    } catch (error) {
      console.error("Database fetch Error:", error);
      return_data.message = "Error fetching socketid";
    }
  }
  async getCustomerOrders(customerId: number) {
    const return_data = {
      error: true,
      message: "",
      data: null,
    };

    try {
      // Fetch orders for the given customer
      const orders = await this.select(
        this.table,
        "*",
        `WHERE cust_id = ${customerId} AND is_deleted = false`,
        "",
        "ORDER BY order_created_on DESC"
      );

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
      data: null,
    };

    try {
      const orders = await this.select(
        this.table,
        "*",
        "WHERE is_deleted = false",
        "",
        "ORDER BY order_created_on DESC"
      );

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
