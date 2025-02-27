import { appdb } from "./appdb";

export class dbVehicleType extends appdb {
  constructor() {
    super();
    this.table = "vehicletypes";
    this.uniqueField = "id";
  }

  async checkVehicleType(vehicleType: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    const checkResult = await this.select(
      this.table,
      "*",
      `WHERE vehicletype_type = '${vehicleType}' AND is_deleted = FALSE`,
      "",
      ""
    );

    if (checkResult.length > 0) {
      return_data.message = "Vehicle type already exists";
      return return_data;
    }
    return_data.error = false;
    return_data.message = "Vehicle type available";
    return_data.data = checkResult.rows[0];
    return return_data;
  }

  async insertVehicleType(
    vehicletype: string,
    max_weight: number,
    createdIp: string
  ) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
    
      this.where = `WHERE vehicletype_type = '${vehicletype}'`;
      let existingVehicle: any[] = await this.allRecords("*");

      if (existingVehicle.length > 0) {
        const vehicle = existingVehicle[0];
        if (!vehicle.is_deleted) {
          return_data.message = "Vehicle type already exists.";
          return return_data;
        }

        let updateData = {
          vehicletype_max_weight: max_weight,
          vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          vehicletype_created_ip: createdIp,
          is_deleted: false, 
        };

        let updateResult = await this.update( this.table,updateData,`WHERE vehicletype_type = '${vehicletype}' `);
        if (!updateResult) {
          return_data.message = "Vehicle type update error";
          return return_data;
        }

        return_data.error = false;
        return_data.data = updateResult;
        return_data.message = "Vehicle type reactivated successfully";
        return return_data;
      }

      // If vehicle type does not exist, create a new one
      let insertData = {
        vehicletype_type: vehicletype,
        vehicletype_max_weight: max_weight,
        vehicletype_created_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
        vehicletype_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
        vehicletype_created_ip: createdIp,
        is_deleted: false,
      };

      let insertResult = await this.insertRecord(insertData);
      if (!insertResult) {
        return_data.message = "Vehicle type creation error";
        return return_data;
      }

      return_data.error = false;
      return_data.data = insertResult;
      return_data.message = "Vehicle type inserted successfully";
      return return_data;
    } catch (error) {
      console.error("Database Insert Error:", error); // Debugging log
      return_data.error = true;
      return_data.message = "Error inserting vehicle type";
      return return_data;
    }
  }

  async getVehicleTypeById(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      const result = await this.selectRecord(id);
      if (!result) {
        return_data.message = "Vehicle type not found";
      } else {
        return_data.error = false;
        return_data.message = "Vehicle type retrieved successfully";
        return_data.data = result;
        return return_data;
      }
    } catch (error) {
      return_data.message = "Error retrieving vehicle type";
    }
  }

  async getAllVehicleTypes() {
    let return_data = {
      error: true,
      message: "",
      data: [],
    };

    try {
      this.where = "WHERE is_deleted = FALSE";
      const result = await this.allRecords("*");
      return_data.error = false;
      return_data.message = "Vehicle types retrieved successfully";
      return_data.data = result;
    } catch (error) {
      return_data.message = "Error retrieving vehicle types";
    }
    return return_data;
  }

  async getVehicleTypeIdByName(vehicletype: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };
    this.where=`WHERE vehicletype_type = '${vehicletype}'`
    const vehicletypeResult = await this.allRecords("id")

    if (vehicletypeResult.length === 0) {
      return_data.message = "Vehicle type not found";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "Vehicle type ID retrieved";
    return_data.data = vehicletypeResult[0];
    return return_data;
  }

  async updateVehicleType(id: number, vehicletype: string, max_weight: number) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    const updateData = {
      vehicletype_type: vehicletype,
      vehicletype_max_weight: max_weight,
      vehicletype_updated_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
    };

    const updateResult = await this.update(
      this.table,
      updateData,
      `WHERE id = ${id} AND is_deleted = FALSE`
    );

    if (!updateResult) {
      return_data.message = `No vehicle type found with ID ${id}`;
      return return_data;
    }

    return_data.error = false;
    return_data.message = "Vehicle type updated successfully";
    return_data.data = { id, ...updateData };
    return return_data;
  }

async deleteVehicleType(id: number) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    const deleteData = {
      is_deleted: true,
      vehicletype_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
    };

    const deleteResult = await this.update(this.table,deleteData,`WHERE id = ${id} AND is_deleted = FALSE` );

    if (!deleteResult) {
      return_data.message = `No vehicle type found with ID ${id}`;
      return return_data;
    }

    return_data.error = false;
    return_data.message = "Vehicle type deleted successfully";
    return_data.data = deleteResult;
    return return_data;
  }
}
