import  express ,{ Request ,Response,NextFunction} from 'express';
import requestIp from 'request-ip'
import { dbCity } from '../model/citymodel';
import { functions } from '../library/functions';
import Joi from 'joi';
import { validations } from '../library/validations';
import { error } from 'console';
const router =express.Router();

router.post("/create",cityValidation,createCityController)
router.put("/update", idValidation,cityValidation, updateCityController);
router.put("/delete", idValidation,deleteCityController);
router.get("/city",idValidation,  getCityByIdController);
router.get("/cities", getAllCitiesController);
module.exports = router;

var cityObj=new dbCity();
var functionsObj=new functions();
var  validationsObj = new validations();

// city schema
function cityValidation(req: any, res: any, next: any) {
  const schema = Joi.object({
    city: Joi.string().min(2).max(50).trim().required().messages({
      "string.empty": "City name is required.",
      "string.min": "City name must be at least 2 characters.",
      "string.max": "City name must be at most 50 characters.",
    }),
    state: Joi.string().min(2).max(50).trim().required().messages({
      "string.empty": "State name is required.",
      "string.min": "State name must be at least 2 characters.",
      "string.max": "State name must be at most 50 characters.",
    }),
  });

    if (!validationsObj.validateRequest(req, res, next, schema)) {
      return;
    }
  
    next();
}
//create city

async function createCityController(req: any, res: any, next: any){
  try {
    const { city, state } = req.body;
    const createdIp = requestIp.getClientIp(req) || "";

    const cities :any = await cityObj.insertCity(city, state, createdIp);

    if (cities.error) {
       return res.send(functionsObj.output(0, cities.message));
    }

    return res.send(functionsObj.output(0, cities.message,cities.data));
  } catch (error: any) {
    console.error("Error creating city:", error);

   return res.send(functionsObj.output(0, "Internal server error",error));
  }
};

// id validtaion
function idValidation(req: any, res: any, next: any) {
  const schema = Joi.object({
    id: Joi.number().integer().min(1).required().messages({
      "number.base": "City ID must be a number",
      "number.integer": "City ID must be an integer",
      "number.min": "City ID must be greater than 0",
      "any.required": "City ID is required"
    }),
  });

    if (!validationsObj.validateRequest(req, res, next, schema)) {
      return;
    }
  
    next();
}
// Get City by ID
async function getCityByIdController(req: any, res: any, next: any) {
  try {
    const { id } = req.body;

  
    const city: any = await cityObj.getCityById(id);

    if (city.error) {
      return res.send(functionsObj.output(0, "City not found"));
    }

    return res.send(functionsObj.output(1, "City found", city.data));
  } catch (error: any) {
    console.error("Error fetching city:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Get all Cities
async function getAllCitiesController(req: any, res: any, next: any) {
  try {
    const cities: any = await cityObj.getAllCity();

    if (cities.error) {
      return res.send(functionsObj.output(0, "No cities found"));
    }

    return res.send(functionsObj.output(1, "Cities retrieved successfully", cities.data));
  } catch (error: any) {
    console.error("Error fetching all cities:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}


// Update City
async function updateCityController(req: any, res: any, next: any) {
  try {
    
    const {id, city, state } = req.body;

    const updatedCity: any = await cityObj.updateCity(id, city, state);

    if (!updatedCity.error) {
      return res.send(functionsObj.output(0, updatedCity.message));
    }

    return res.send(functionsObj.output(1, updatedCity.message, updatedCity.data));
  } catch (error: any) {
    console.error("Error updating city:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Delete City


async function deleteCityController(req: any, res: any, next: any) {
  try {
    const { id } = req.body;

   

    const deletedCity: any = await cityObj.deleteCity(id);

    if (!deletedCity) {
      return res.send(functionsObj.output(0, "City not found"));
    }

    return res.send(functionsObj.output(1, "City deleted successfully",deletedCity.data));
  } catch (error: any) {
    console.error("Error deleting city:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}
