import { appdb } from "./appdb";

export class dbVehicles extends appdb {
    constructor() {
      super();
      this.table = "vehicles";
      this.uniqueField="id"
    }
  
async insertOrUpdateVehicle(dpartner_id: number, vehicletype_id: number, vehicle_number: string, vehicle_name: string, vehicle_created_ip: string) {
      let return_data = { error: true, message: "", data: {} };
      try {
        this.where=`WHERE vehicle_number = '${vehicle_number}' AND dpartner_id = ${dpartner_id}`
        const existingVehicle = await this.allRecords("*");
        let vehicleResult;
  
        if (existingVehicle.length > 0) {
          const vehicle = existingVehicle[0];
          if (vehicle.is_deleted) {
            const updateVehicleData = {
              vehicletype_id,
              vehicle_number,
              vehicle_name,
              vehicle_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
              vehicle_created_ip,
              is_deleted: false,
            };
            vehicleResult = await this.update(this.table, updateVehicleData, `WHERE id=${vehicle.id} AND dpartner_id ='${vehicle.dpartner_id}'`);
            if (!vehicleResult) {
                return_data.message = "VEHICLE_INSERT_ERROR";
                return return_data;
            }
          } else {
           return_data.message="VEHICLE_EXISTS";
          }
        } else {
          const insertVehicleData = {
            vehicle_number,
            vehicletype_id,
            vehicle_name,
            dpartner_id,
            vehicle_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
            vehicle_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
            vehicle_created_ip,
            is_deleted: false,
          };
          vehicleResult = await this.insertRecord(insertVehicleData);
          if (!vehicleResult) {
            return_data.message = "VEHICLE_INSERT_ERROR";
            return return_data;
          }
        }
        return_data.error = false;
        return_data.message = "VEHICLE_INSERT_SUCCESS";
        return_data.data = vehicleResult;
        return return_data;
      } catch (error) {
        return_data.message ="VEHICLE_INSERT_ERROR "
        return return_data;
      }
    
}

async softDeleteVehiclesByDpartnerId(dpartner_id: number) {
    let return_data = { error: true, message: "", data: {} };
  
    try {
      let vehicleUpdateData = {
        is_deleted: true,
        vehicle_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };
  
      let vehicleResult = await this.update(this.table,vehicleUpdateData,`WHERE dpartner_id = '${dpartner_id}'` );
  
      if (!vehicleResult) {
        return_data.message = "VEHICLE_DELETE_ERROR";
        return return_data;
      }
  
      return_data.error = false;
      return_data.message = "VEHICLE_DELETE_SUCCESS";
      return_data.data = vehicleResult;
      return return_data;
    } catch (error) {
     
      return_data.message = "VEHICLE_DELETE_ERROR";
      return return_data;
    }
  }
}