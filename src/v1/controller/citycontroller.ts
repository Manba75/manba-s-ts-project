import express, { Request, Response, NextFunction } from 'express';
import requestIp from 'request-ip';
import { dbCity } from '../model/citymodel';
import { functions } from '../library/functions';
import Joi from 'joi';
import { validations } from '../library/validations';

const router = express.Router();

router.post("/create", cityValidation, createCityController);
router.put("/update", idValidation, cityValidation, updateCityController);
router.put("/delete", idValidation, deleteCityController);
router.get("/city", idValidation, getCityByIdController);
router.get("/cities", getAllCitiesController);
module.exports = router;

var cityObj = new dbCity();

// city schema
function cityValidation(req: Request, res: Response, next: NextFunction) {
  const validationsObj = new validations();
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

// create city
async function createCityController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const { city, state } = req.body;
    const createdIp = requestIp.getClientIp(req) || "";

    const cities: any = await cityObj.insertCity(city, state, createdIp);

    if (cities.error) {
      res.send(functionsObj.output(0, "CITY_INSERT_ERROR", cities.message));
      return;
    }

    res.send(functionsObj.output(0, "CITY_INSERT_SUCCESS", cities.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "CITY_INSERT_ERROR", error));
    return;
  }
}

// id validation
function idValidation(req: Request, res: Response, next: NextFunction) {
  const validationsObj = new validations();
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
async function getCityByIdController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const { id } = req.body;

    const city: any = await cityObj.getCityById(id);

    if (city.error) {
      res.send(functionsObj.output(0, "CITY_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "CITY_FETCH_SUCCESS", city.data));
    return;
  } catch (error: any) {
   
    res.send(functionsObj.output(0, "CITY_FETCH_ERROR", error));
    return;
  }
}

// Get all Cities

async function getAllCitiesController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const cities: any = await cityObj.getAllCity();

    if (cities.error) {
      res.send(functionsObj.output(0, "CITIES_FETCH_ERROR"));
      return;
    }

    res.send(functionsObj.output(1, "CITIES_FETCH_SUCCESS", cities.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "CITIES_FETCH_ERROR", error));
    return;
  }
}

// Update City


async function updateCityController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const { id, city, state } = req.body;

    let updatedCity :any= await cityObj.updateCity(id, city, state);

    if (updatedCity.error) {
      res.send(functionsObj.output(0, "CITY_UPDATE_ERROR"));
      return;
    }

    res.send(functionsObj.output(1,"CITY_UPDATE_SUCCESS", updatedCity.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "CITY_UPDATE_ERROR", error));
    return;
  }
}

// Delete City
async function deleteCityController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const { id } = req.body;
    const deletedCity: any = await cityObj.deleteCity(id);

    if (!deletedCity) {
      res.send(functionsObj.output(0, "CITY_DELETE_ERROR"));
      return;
    }

    res.send(functionsObj.output(1, "CITY_DELETE_SUCCESS", deletedCity.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "CITY_DELETE_ERROR", error));
    return;
  }
}