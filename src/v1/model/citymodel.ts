import { error } from "console";
import { appdb } from "./appdb";

export class dbCity extends appdb 
{
constructor() {
  super();
  this.table = "cities";
  this.uniqueField = "id";
}
/**
 *
 * @param city
 * @returns
 */
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
    } else {
      return_data.error = false;
      return_data.data = cities.rows[0];
      return_data.message = "Successfully created city";
      return return_data;
    }
  } catch (error) {
    console.error("Database fetching Error:", error); // Debugging log
    return_data.error = true;
    return_data.message = "Error checking record into database";
    return return_data;
  }
}

/**
 *
 * @param city
 * @param state
 * @param createdIp
 * @returns
 */
async insertCity(city: string, state: string, createdIp: string) {
  let return_data = {
    error: true,
    message: "",
    data: {},
  };

  try {
    await this.executeQuery("BEGIN"); // Start transaction

    // Check if the city exists in the given state
    this.where = `WHERE city_name = '${city}' AND city_state_name = '${state}'`;
    let existingCity: any[] = await this.allRecords("*");
  

    if (existingCity.length > 0) {
      const cityRecord = existingCity[0];

      if (!cityRecord.is_deleted) {
        await this.executeQuery("ROLLBACK");
        return_data.message = "City already exists in this state.";
        return return_data;
      }

      // Reactivate the deleted city
      let updateData = {
        is_deleted: false,
        city_updated_on: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, -1),
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

    // If city does not exist, insert a new record
    let insertData = {
      city_name: city,
      city_state_name: state,
      city_created_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
      city_updated_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
      city_created_ip: createdIp,
      is_deleted: false,
    };

    let insertResult = await this.insertRecord(insertData);
    if (!insertResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message = "Failed to insert city.";
      return return_data;
    }

    await this.executeQuery("COMMIT"); // Commit transaction
    return_data.error = false;
    return_data.data = insertResult;
    return_data.message = "City added successfully.";
    return return_data;
  } catch (error) {
    await this.executeQuery("ROLLBACK");
    console.error("Database Insert Error:", error);
    return_data.message = "Error inserting record into database.";
    return return_data;
  }
}

// get cityid
/**
 *
 * @param id
 * @returns
 */
async getCityById(id: number) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let cityResult = await this.select(
      this.table,
      "*",
      `WHERE id = '${id}' AND is_deleted=false`,
      "",
      ""
    );

    if (cityResult.length === 0) {
      return_data.message = `No city found with ID ${id}`;
      return return_data;
    } else {
      return_data.error = false;
      return_data.message = "City found";
      return_data.data = cityResult[0];
      return return_data;
    }
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error fetching city by ID.";
  }
}

/**
 * Get all cities
 */

async getAllCity() {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let cityResult = await this.select(
      this.table,
      "*",
      "WHERE is_deleted = FALSE",
      "",
      ""
    );

    if (cityResult.length === 0) {
      return_data.message = "No cities found.";
      return return_data;
    } else {
      return_data.error = false;
      return_data.message = "Cities fetched successfully.";
      return_data.data = cityResult;
      return return_data;
    }
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error fetching all cities.";
  }
}

 // Get City ID by Name
 

async getCityIdByCityName(city: string) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    let cityResult = await this.select(
      this.table,
      "id",
      `WHERE city_name = '${city}'`,
      "",
      ""
    );

    if (cityResult.length === 0) {
      return_data.message = "City not found.";
      return return_data;
    } else {
      return_data.error = false;
      return_data.message = "City ID found.";
      return_data.data = cityResult[0].id;
      return return_data;
    }
  } catch (error) {
    console.error("Database fetch Error:", error);
    return_data.message = "Error fetching city ID.";
  }
}

/**
 * Update city details
 */
async updateCity(id: number, city: string, state: string) {
  let return_data = {
    error: true,
    message: " ",
    data: {},
  };

  try {
    await this.executeQuery("BEGIN");

    // Check if city already exists with the same name and state

    let checkResult = await this.select(
      this.table,
      "*",
      `WHERE city_name = '${city}' AND city_state_name = '${state}' AND id <> '${id}' AND is_deleted = FALSE`,
      "",
      ""
    );

    if (checkResult.length > 0) {
      await this.executeQuery("ROLLBACK");
      return_data.message =
        "City with the same name and state already exists.";
      return return_data;
    }

    let updateData = {
      city_name: city,
      city_state_name: state,
      city_updated_on: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, -1),
    };
    // Update city if no duplicate found
    let updateResult = await this.update(
      this.table,
      updateData,
      `WHERE id = '${id}' AND is_deleted = false`
    );

    if (!updateResult) {
      await this.executeQuery("ROLLBACK");
      return_data.message = `No city found with ID ${id}`;
      return return_data;
    }

    await this.executeQuery("COMMIT");
    return_data.error = false;
    return_data.message = "City updated successfully.";
    return_data.data = updateResult;
  } catch (error) {
    await this.executeQuery("ROLLBACK");
    console.error("Database update Error:", error);
    return_data.message = "Error updating city.";
  }

  return return_data;
}

/**
 * Soft delete city
 */
async deleteCity(id: number) {
  let return_data = {
    error: true,
    message: " ",
    data:0,
  };

  try {
 
    let updateData = {
      is_deleted: true,
      city_updated_on: new Date().toISOString().replace("T", " ").slice(0, -1),
    };
    let deleteResult = await this.updateRecord(id,updateData );

    if (deleteResult.affectedRows === 0) {
      return_data.message = `No city found with ID ${id}`;
      return return_data;
    }

    return_data.error = false;
    return_data.message = "City deleted successfully.";
    return_data.data = deleteResult;
  } catch (error) {
    console.error("Database delete Error:", error);
    return_data.message = "Error deleting city.";
  }

  return return_data;
}

/**
 * Get city details by names (pickup & drop)
 */

async getCityDetails( pickupCity: string, dropCity: string): Promise<{error: boolean; message: string;data: {pickupCityDetails: {id: number;city_name: string;city_state_name: string; } | null;dropCityDetails: {id: number;city_name: string; city_state_name: string;} | null} | null;}> 
{
  const return_data = {
    error: true,
    message: "",
    data: {
      pickupCityDetails: null as { id: number;city_name: string;city_state_name: string;} | null,
      dropCityDetails: null as {id: number;city_name: string; city_state_name: string; } | null,
    },
  };

  try {
    let cityResult: any = await this.select( this.table, "id, city_name, city_state_name",`WHERE city_name IN ('${pickupCity}', '${dropCity}')`,"", "");

    if (!cityResult || !Array.isArray(cityResult) || cityResult.length < 2) {
      return_data.message = "One or both cities not found.";
      return return_data;
    }

    return_data.data.pickupCityDetails =cityResult.find((city: any) => city.city_name === pickupCity) || null;

    return_data.data.dropCityDetails =cityResult.find((city: any) => city.city_name === dropCity) || null;

    if (!return_data.data.pickupCityDetails || !return_data.data.dropCityDetails) {
      return_data.message = "Error extracting city details.";
      return return_data;
    }

    return_data.error = false;
    return_data.message = "City details fetched successfully.";
    return return_data;
  } catch (error) {
    console.error("Error fetching city details:", error);
    return_data.message = "An error occurred while fetching city details.";
    return return_data;
  }
}

}
