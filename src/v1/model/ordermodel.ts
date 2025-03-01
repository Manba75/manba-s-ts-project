import { dbaddress } from "./addressmodel";
import { appdb } from "./appdb";
import { dbCity } from "./citymodel";

export class dborders extends appdb {
  addressmodel: dbaddress;
  citymodel: dbCity;

  constructor() {
    super();
    this.table = "orders";
    this.uniqueField = "id";
    this.addressmodel = new dbaddress();
    this.citymodel = new dbCity();
  }

  async orderPlace(cust_id: number, vehicletype: number, pickup: any, drop: any, order_charge: number, createdIp: string) {
    const return_data = { error: true, message: "", data: null };

    await this.executeQuery("BEGIN");

    const cityDetailsResponse = await this.citymodel.getCityDetails(pickup.city, drop.city);

    if (cityDetailsResponse.error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = cityDetailsResponse.message || "City details not found";
      return return_data;
    }

    const pickupCityDetails: any = cityDetailsResponse.data?.pickupCityDetails;
    const dropCityDetails: any = cityDetailsResponse.data?.dropCityDetails;

    let pickupResponse = await this.addressmodel.getExistingAddress(cust_id, pickupCityDetails.id, pickup, "pickup");
    let pickup_id = pickupResponse.data;

    if (!pickup_id) {
      const insertPickup = await this.addressmodel.insertAddress(pickupCityDetails.id, cust_id, pickup, "pickup", createdIp);
      if (insertPickup.error) {
        await this.executeQuery("ROLLBACK");
        return insertPickup;
      }
      pickup_id = insertPickup.data;
    }

    let dropResponse = await this.addressmodel.getExistingAddress(cust_id, dropCityDetails.id, drop, "drop");
    let drop_id = dropResponse.data;

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

  async getOrderById(orderId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let orderResult = await this.select(this.table, "*", `WHERE id = '${orderId}' AND is_deleted=false`, "", "");

      if (orderResult.length === 0) {
        return_data.message = `No order found with ID ${orderId}`;
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Order retrieved successfully";
      return_data.data = orderResult[0];
      return return_data;
    } catch (error) {
      return_data.message = "Error fetching order by ID.";
      return return_data;
    }
  }

  async assignDeliveryPartner(orderId: number, dpartnerId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let updateData = { dpartner_id: dpartnerId, order_status: "accepted" };
      let updatedResult = await this.updateRecord(orderId, updateData);
     

      if (!updatedResult) {
        return_data.message = `No order accepted by any delivery partners`;
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Order accepted successfully";
      return_data.data = updatedResult;
      return return_data;
    } catch (error) {
      return_data.message = "Error assigning delivery partners.";
      return return_data;
    }
  }

  async updateOrderStatus(orderId: number, status: string, dpartnerId: number) {
    let return_data = { error: true, message: " ", data: {} };

    try {
      let updateData = { order_status: status, dpartner_id: dpartnerId };
      let updatedResult = await this.updateRecord(orderId, updateData);

      if (!updatedResult) {
        return_data.message = `No order status updated by delivery partners`;
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Order status changed successfully";
      return_data.data = updatedResult;
      return return_data;
    } catch (error) {
      return_data.message = "Error updating order status.";
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
      const orders = await this.select(this.table, "*", `WHERE cust_id = ${customerId} AND is_deleted = false`, "", "ORDER BY order_created_on DESC");

      if (!orders || orders.length === 0) {
        return_data.message = "No orders found for this customer.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "Orders retrieved successfully.";
      return_data.data = orders;
      return return_data;
    } catch (error) {
      return_data.message = "Error fetching orders.";
      return return_data;
    }
  }

  async getAllOrders() {
    const return_data = { error: true, message: "", data: { result: new Array() } };

    try {
      this.where = "WHERE is_deleted = false";
      let orders = await this.allRecords("*");

      if (!orders || orders.length === 0) {
        return_data.message = "No orders found.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "All orders retrieved successfully.";
      return_data.data = orders;
      return return_data;
    } catch (error) {
      return_data.message = "Error fetching all orders.";
      return return_data;
    }
  }
}