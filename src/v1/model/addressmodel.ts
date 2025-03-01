import { appdb } from "./appdb";

export class dbaddress  extends appdb {

constructor() {
    super();
    this.table = "address";
    this.uniqueField = "id";
    }

async getExistingAddress(cust_id: number,city_id: number,address: any,address_type: string) 
{
    const return_data = {
    error: true,
    message: "Address lookup failed",
    data: null,
    };

    await this.executeQuery("BEGIN");

    try {
    const street = address.street ? address.street.replace(/'/g, "''") : "";
    const flatno = address.flatno ? address.flatno.replace(/'/g, "''") : "";
    const pincode = address.pincode ? address.pincode.replace(/'/g, "''") : "";
    const landmark = address.landmark ? address.landmark.replace(/'/g, "''") : "";
    const type = address_type ? address_type.replace(/'/g, "''") : "";

    const whereClause = `
        WHERE cust_id = ${cust_id}
        AND address_city_id = ${city_id}
        AND address_street = '${street}'
        AND address_flatno = '${flatno}'
        AND address_pincode = '${pincode}'
        AND address_landmark = '${landmark}'
        AND address_type = '${type}'
    `;
  
    this.where=whereClause
    const result = await this.allRecords("*");

    if (Array.isArray(result) && result.length > 0) {
        await this.executeQuery("COMMIT");
        return_data.error = false;
        return_data.message = "Address found";
        return_data.data = result[0].id; 
    } else {
        await this.executeQuery("ROLLBACK");
    }
    }
     catch (error) {
    await this.executeQuery("ROLLBACK");
    console.error("Error in getExistingAddress:", error);
    return_data.message = "Database error occurred";
    }

    return return_data;
}

async insertAddress(city_id: number,cust_id: number,address: any,address_type: string,createdIp: string) 
{
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
    address_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
    address_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
    address_created_ip: createdIp,
    };

    const insertResult = await this.insertRecord(addressData);

    if (!insertResult) {
    await this.executeQuery("ROLLBACK");
    return_data.message = "Address insertion failed";
    return return_data;
    }

    await this.executeQuery("COMMIT");
    return_data.error = false;
    return_data.message = "Address inserted successfully";
    return_data.data = insertResult;

    return return_data;
}
}
  

  