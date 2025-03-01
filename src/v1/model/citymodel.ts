import { appdb } from "./appdb";

export class dbCity extends appdb {
  constructor() {
    super();
    this.table = "cities";
    this.uniqueField = "id";
  }

  async checkCity(city: string) {
    let return_data = {
      error: true,
      message: " ",
      data: {},
    };

    try {
      this.where = `WHERE city_name= ${city}`;
      const cities = await this.allRecords("*");

      if (!cities) {
        return_data.message = "city not found";
        return return_data;
      } 
        return_data.error = false;
        return_data.data = cities.rows[0];
        return_data.message = "Successfully created city";
        return return_data;
    
    } catch (error) {
      return_data.error = true;
      return_data.message = "Error checking record into database";
      return return_data;
    }
  }

  async insertCity(city: string, state: string, createdIp: string) {
    let return_data = {
      error: true,
      message: "",
      data: {},
    };

    try {
      await this.executeQuery("BEGIN");

      this.where = `WHERE city_name = '${city}' AND city_state_name = '${state}'`;
      let existingCity: any[] = await this.allRecords("*");

      if (existingCity.length > 0) {
        const cityRecord = existingCity[0];

        if (!cityRecord.is_deleted) {
          await this.executeQuery("ROLLBACK");
          return_data.message = "City already exists in this state.";
          return return_data;
        }

        let updateData = {
          is_deleted: false,
          city_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
          city_created_ip: createdIp,
        };

        let updateResult = await this.updateRecord(cityRecord.id, updateData);
        if (!updateResult) {
          await this.executeQuery("ROLLBACK");
          return_data.message = "Failed to reactivate city.";
          return return_data;
        }

        await this.executeQuery("COMMIT");
        return_data.error = false;
        return_data.data = updateResult;
        return_data.message = "City reactivated successfully.";
        return return_data;
      }

      let insertData = {
        city_name: city,
        city_state_name: state,
        city_created_on: new Date().toISOString().replace("T", " ").slice(0, -1),
        city_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
        city_created_ip: createdIp,
        is_deleted: false,
      };

      let insertResult = await this.insertRecord(insertData);
      if (!insertResult) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "Failed to insert city.";
        return return_data;
      }

      await this.executeQuery("COMMIT");
      return_data.error = false;
      return_data.data = insertResult;
      return_data.message = "City added successfully.";
      return return_data;
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "Error inserting record into database.";
      return return_data;
    }
  }

  async getCityById(id: number) {
    let return_data = {
      error: true,
      message: " ",
      data: {},
    };

    try {
      this.where = `WHERE id = '${id}' AND is_deleted=false`;
      let cityResult = await this.listRecords("*");

      if (cityResult.length === 0) {
        return_data.message = `No city found with ID ${id}`;
        return return_data;
      }
      return_data.error = false;
      return_data.message = "City found";
      return_data.data = cityResult[0];
      return return_data;
    } catch (error) {
      return_data.message = "Error fetching city by ID.";
      return return_data;
    }
  }

  async getAllCity() {
    let return_data = {
      error: true,
      message: " ",
      data: {
        result: new Array(),
      },
    };

    try {
      this.where = "WHERE is_deleted = false";
      let cityResult = await this.allRecords("*");

      if (cityResult.length === 0) {
        return_data.message = "No cities found.";
        return return_data;
      } 
        return_data.error = false;
        return_data.message = "Cities fetched successfully.";
        return_data.data = cityResult;
        return return_data;
     
    } catch (error) {
      return_data.message = "Error fetching all cities.";
      return return_data;
    }
  }

  async getCityIdByCityName(city: string) {
    let return_data = {
      error: true,
      message: " ",
      data: {},
    };

    try {
      this.where = `WHERE city_name = '${city}' AND is_deleted=false`;
      let cityResult = await this.allRecords("*");

      if (cityResult.length === 0) {
        return_data.message = "City not found.";
        return return_data;
      }
      return_data.error = false;
      return_data.message = "City ID found.";
      return_data.data = cityResult[0].id;
      return return_data;
    } catch (error) {
      return_data.message = "Error fetching city ID.";
      return return_data;
    }
  }

  async updateCity(id: number, city: string, state: string) {
    let return_data = {
      error: true,
      message: " ",
      data: {} ,
    };

    try {
      await this.executeQuery("BEGIN");

      this.where = `WHERE city_name = '${city}' AND city_state_name = '${state}' AND id <> '${id}' AND is_deleted = FALSE`;
      let checkResult = await this.allRecords("*");

      if (checkResult.length > 0) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "City with the same name and state already exists.";
        return_data.data = { existingCityId: checkResult[0].id };
        return return_data;
      }

      let updateData = {
        city_name: city,
        city_state_name: state,
        city_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };

      let updateResult = await this.updateRecord(id, updateData);

      if (!updateResult) {
        await this.executeQuery("ROLLBACK");
        return_data.message = `No city found with ID ${id}`;
        return return_data;
      }

      
      return_data.error = false;
      return_data.message = "City updated successfully.";
      return_data.data = updateResult;
      await this.executeQuery("COMMIT");
      return return_data;
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "Error updating city.";
      return return_data;
    }
  }

  async deleteCity(id: number) {
    let return_data = {
      error: true,
      message: " ",
      data: 0,
    };

    try {
      let updateData = {
        is_deleted: true,
        city_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
      };
      let deleteResult = await this.update(this.table,updateData ,`WHERE id = ${id} AND is_deleted = FALSE`);

      if (deleteResult.affectedRows === 0) {
        return_data.message = `No city found with ID ${id}`;
        return return_data;
      }

      return_data.error = false;
      return_data.message = "City deleted successfully.";
      return_data.data = deleteResult;
      return return_data;
    } catch (error) {
      return_data.message = "Error deleting city.";
      return return_data;
    }
  }

  async getCityDetails(pickupCity: string, dropCity: string): Promise<{
    error: boolean;
    message: string;
    data: {
      pickupCityDetails: { id: number; city_name: string; city_state_name: string } | null;
      dropCityDetails: { id: number; city_name: string; city_state_name: string } | null;
    } | null;
  }> {
    const return_data = {
      error: true,
      message: "",
      data: {
        pickupCityDetails: null as { id: number; city_name: string; city_state_name: string } | null,
        dropCityDetails: null as { id: number; city_name: string; city_state_name: string } | null,
      },
    };

    try {
      this.where=`WHERE city_name IN ('${pickupCity}', '${dropCity}') AND is_deleted = FALSE`;
      let cityResult: any = await this.allRecords( "id, city_name, city_state_name")
      

      if (!cityResult || !Array.isArray(cityResult) || cityResult.length < 2) {
        return_data.message = "One or both cities not found.";
        return return_data;
      }

      return_data.data.pickupCityDetails = cityResult.find((city: any) => city.city_name === pickupCity) || null;
      return_data.data.dropCityDetails = cityResult.find((city: any) => city.city_name === dropCity) || null;

      if (!return_data.data.pickupCityDetails || !return_data.data.dropCityDetails) {
        return_data.message = "Error extracting city details.";
        return return_data;
      }

      return_data.error = false;
      return_data.message = "City details fetched successfully.";
      return return_data;
    } catch (error) {
      return_data.message = "An error occurred while fetching city details.";
      return return_data;
    }
  }
}