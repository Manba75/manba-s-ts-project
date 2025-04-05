import { appdb } from "./appdb";

export class dbVehicleType extends appdb {
constructor() {
  super();
  this.table = "vehicletypes";
  this.uniqueField = "id";
}

async checkVehicleType(vehicleType: string) {
  let return_data = { error: true, message: "", data: {} };
  this.where = `WHERE vehicletype_type = '${vehicleType}' AND is_deleted = FALSE`;
  const checkResult = await this.allRecords("*");

  if (checkResult.length > 0) {
    return_data.message = "VEHICLE_TYPE_EXISTS";
    return return_data;
  }
  return_data.error = false;
  return_data.message = "VEHICLE_TYPE_FETCH_SUCCESS";
  return_data.data = checkResult.rows[0];
  return return_data;
}

async insertVehicleType(vehicletype: string, max_weight: number, createdIp: string,vehicletype_img: string) {
  let return_data = { error: true, message: "", data: {}, };

  try {
    await this.executeQuery("BEGIN");
    this.where = `WHERE vehicletype_type = '${vehicletype}'`;
    let existingVehicle: any[] = await this.allRecords("*");

    if (existingVehicle.length > 0) {
      const vehicle = existingVehicle[0];
      if (!vehicle.is_deleted) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "VEHICLE_TYPE_EXISTS";
        return return_data;
      }else{
        let updateData = {
          vehicletype_max_weight: max_weight,
         
          vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          vehicletype_created_ip: createdIp,
          is_deleted: false,
          vehicletype_img: vehicletype_img,
        };
  
        let updateResult = await this.update(this.table, updateData, `WHERE vehicletype_type = '${vehicletype}'`);
        console.log(updateResult)
        if (!updateResult) {
          await this.executeQuery("ROLLBACK");
          return_data.message = "VEHICLE_TYPE_INSERT_ERROR";
          return return_data;
        }
  
        return_data.error = false;
        return_data.data = updateResult;
        return_data.message = "VEHICLE_TYPE_INSERT_SUCCESS";
        return return_data;
      }


    }

    let insertData = {
      vehicletype_type: vehicletype,
      vehicletype_max_weight: max_weight,
      vehicletype_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      vehicletype_created_ip: createdIp,
      is_deleted: false,
      vehicletype_img: vehicletype_img,
    };

    let insertResult = await this.insertRecord(insertData);
    console.log(insertResult)
    if (!insertResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "VEHICLE_TYPE_INSERT_ERROR";
      return return_data;
    }


    await this.executeQuery("COMMIT");
    return_data.error = false;
    return_data.data = insertResult;
    return_data.message = "VEHICLE_TYPE_INSERT_SUCCESS";
    return return_data;
  } catch (error) {
    await this.executeQuery("ROLLBACK");
    return_data.message = "VEHICLE_TYPE_INSERT_ERROR";
    return return_data;
  }
}

async getVehicleTypeById(id: number) {
  let return_data = { error: true, message: "", data: {} };

  try {
    this.where = `WHERE id = '${id}' AND is_deleted=false`;
    let result = await this.listRecords("*");

    if (result.length === 0) {
      return_data.message = "VEHICLE_TYPE_NOT_FOUND";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "VEHICLE_TYPE_FETCH_SUCCESS";
    return_data.data = result[0];
    return return_data;
  } catch (error) {
    return_data.message = "VEHICLE_TYPE_FETCH_ERROR";
    return return_data;
  }
}

async getAllVehicleTypes() {
  let return_data = { error: true, message: "", data: { result: new Array() } };

  try {
    this.where = "WHERE is_deleted = false";
    let result = await this.allRecords("*");
    

    if(result.length === 0) {
      return_data.message = "VEHICLE_TYPES_NOT_FOUND";
      return  return_data;
    }
    return_data.error = false;
    return_data.message = "VEHICLE_TYPES_FETCH_SUCCESS";
    return_data.data = result;
    return return_data;
  } catch (error) {
    return_data.message = "VEHICLE_TYPES_FETCH_ERROR";
    return return_data;
  }
 
}

async getVehicleTypeIdByName(vehicletype: string) {
  let return_data = { error: true, message: "", data: {} };
  this.where = `WHERE vehicletype_type = '${vehicletype}'`;
  const vehicletypeResult = await this.allRecords("*");

  if (vehicletypeResult.length === 0) {
    return_data.message = "VEHICLE_TYPE_NOT_FOUND";
    return return_data;
  }

  return_data.error = false;
  return_data.message = "VEHICLE_TYPE_FETCH_SUCCESS";
  return_data.data = vehicletypeResult[0];
  return return_data;
}

async updateVehicleType(id: number, vehicletype: string, max_weight: number) {
  let return_data = { error: true, message: "", data: {} };

  const updateData = {
    vehicletype_type: vehicletype,
    vehicletype_max_weight: max_weight,
    vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
  };

  const updateResult = await this.update(this.table, updateData, `WHERE id = ${id} AND is_deleted = FALSE`);

  if (!updateResult) {
    return_data.message = `No vehicle type found with ID ${id}`;
    return return_data;
  }

  return_data.error = false;
  return_data.message = "VEHICLE_TYPE_UPDATED_SUCCESS";
  return_data.data = { id, ...updateData };
  return return_data;
}

async deleteVehicleType(id: number) {
  let return_data = { error: true, message: "", data: 0 };

  const deleteData = {
    is_deleted: true,
    vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
  };

  const deleteResult = await this.update(this.table, deleteData, `WHERE id = ${id} AND is_deleted = FALSE`);

  if (!deleteResult) {
    return_data.message = "VEHICLE_TYPE_NOT_FOUND";
    return return_data;
  }

  return_data.error = false;
  return_data.message = "VEHICLE_TYPE_DELETE_SUCCESS";
  return_data.data = deleteResult;
  return return_data;
}
}