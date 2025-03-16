import express, { Request, Response, NextFunction } from 'express';
import requestIp from 'request-ip';
import { dbCity } from '../model/citymodel';
import { functions } from '../library/functions';
import Joi from 'joi';
import { validations } from '../library/validations';
import { upload } from '../library/multer';
 import { v2 as cloudinary } from "cloudinary";
import { deleteFromCloudinary, extractPublicIdFromUrl, uploadOnCloudinary } from '../library/cloudinary';

const router = express.Router();

router.post("/create",upload.single("city_img"),cityValidation, createCityController);
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
   
    
    if (!req.file || !req.file.path) {
      res.status(400).send(functionsObj.output(0, "CITY_IMAGE_REQUIRED"));
      return;
    }
    const cloudinaryUrl = await uploadOnCloudinary(req.file.path,"city_images");
    if (!cloudinaryUrl) {
      res.status(400).send(functionsObj.output(0, "CITY_IMAGE_UPLOAD_ERROR"));
      return;
    }

  let cities: any = await cityObj.insertCity(city, state, createdIp, cloudinaryUrl.url);

    if (cities.error) {
      res.send(functionsObj.output(0, cities.message));
      return;
    }

    res.send(functionsObj.output(0, cities.message, cities.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0,error.message , error));
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
    let { id } = req.body;

    let city: any = await cityObj.getCityById(id);

    if (city.error) {
      res.send(functionsObj.output(0, city.message));
      return;
    }

    res.send(functionsObj.output(1, city.message, city.data));
    return;
  } catch (error: any) {
   
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}

// Get all Cities

async function getAllCitiesController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    let cities: any = await cityObj.getAllCity();

    if (cities.error) {
      res.send(functionsObj.output(0, cities.message));
      return;
    }

    res.send(functionsObj.output(1, cities.message, cities.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, error.message, error));
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
      res.send(functionsObj.output(0, updatedCity.message));
      return;
    }

    res.send(functionsObj.output(1,updatedCity.message, updatedCity.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0,error.message, error));
    return;
  }
}

async function deleteCityController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  try {
    const { id } = req.body;

    
    const city: any = await cityObj.getCityById(id);
    if (!city || !city.data) {
      res.status(404).send(functionsObj.output(0,city.message));
      return;
    }

    const imageUrl = city.data.city_img;
    if (imageUrl) {
      const publicId = extractPublicIdFromUrl(imageUrl);
      if (publicId) {
       await deleteFromCloudinary(publicId);
      } 
    }
    let deletedCity :any= await cityObj.deleteCity(id);

    if (!deletedCity) {
      res.status(500).send(functionsObj.output(0, deletedCity.message));  
      return;
    }
    res.send(functionsObj.output(1, deletedCity.message, deletedCity.data));

  } catch (error: any) {
    res.status(500).send(functionsObj.output(0, "CITY_DELETE_ERROR", error));
  }
}




