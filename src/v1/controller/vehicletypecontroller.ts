import express, { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import { dbVehicleType } from "../model/vehicletypemodel";
import { functions } from "../library/functions";
import Joi from "joi";
import { validations } from "../library/validations";
import { deleteFromCloudinary, extractPublicIdFromUrl, uploadOnCloudinary } from "../library/cloudinary";
import { upload } from "../library/multer";

const router = express.Router();

router.post("/create",upload.single("vehicletype_img"), vehicleTypeValidation, createVehicleTypeController);
router.get("/vehicletype",idValidation, getVehicleTypeByIdController);
router.get("/vehicletypes", getAllVehicleTypesController);
router.put("/update", vehicleTypeValidation,idValidation,updateVehicleTypeController);
router.put("/delete", deleteVehicleTypeController);

module.exports = router;

// Vehicle Type schema validation
function vehicleTypeValidation(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    vehicletype: Joi.string().min(2).trim().max(50).required().messages({
      "string.empty": "Vehicle type is required.",
      "string.min": "Vehicle type must be at least 2 characters.",
      "string.max": "Vehicle type must be at most 50 characters.",
    }),
    max_weight: Joi.number().positive().required().messages({
      "number.base": "Max weight must be a number.",
      "number.positive": "Max weight must be a positive number.",
      "any.required": "Max weight is required.",
    }),
  });

  const validationsObj = new validations();
  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// Create Vehicle Type
async function createVehicleTypeController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const { vehicletype, max_weight } = req.body;
    const createdIp = requestIp.getClientIp(req) || "";

     if (!req.file || !req.file.path) {
          res.status(400).send(functionsObj.output(0, "VEHICLE_TYPE_IMAGE_REQUIRED"));
          return;
        }
        const cloudinaryUrl = await uploadOnCloudinary(req.file.path,"vehicletype_images");
        if (!cloudinaryUrl) {
          res.status(400).send(functionsObj.output(0, "VEHICLE_TYPE_IMAGE_UPLOAD_ERROR"));
          return;
        }

    let vehicleType = await vehicleTypeObj.insertVehicleType(vehicletype, max_weight, createdIp,cloudinaryUrl.url);
    console.log(vehicleType)
    if (vehicleType.error) {
      res.send(functionsObj.output(0,  vehicleType.message));
      return;
    }

    res.send(functionsObj.output(1, vehicleType.message, vehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}

// id validation
function idValidation(req: Request, res: Response, next: NextFunction) {
  const validationsObj = new validations();
  const schema = Joi.object({
    id: Joi.number().integer().min(1).required().messages({
      "number.base": "vehicletype ID must be a number",
      "number.integer": "vehicletype ID must be an integer",
      "number.min": "vehicletype ID must be greater than 0",
      "any.required": "vehicletype ID is required"
    }),
  });

  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}
// Get Vehicle Type by ID
async function getVehicleTypeByIdController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const { id } = req.body;

    const vehicleType: any = await vehicleTypeObj.getVehicleTypeById(id);

    if (!vehicleType) {
      res.send(functionsObj.output(0, vehicleType.message));
      return;
    }

    res.send(functionsObj.output(1, vehicleType.message, vehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}

// Get all Vehicle Types
async function getAllVehicleTypesController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const vehicleTypes: any = await vehicleTypeObj.getAllVehicleTypes();

    if (vehicleTypes.error || vehicleTypes.length === 0) {
      res.send(functionsObj.output(0, vehicleTypes.message));
      return;
    }

    res.send(functionsObj.output(1, vehicleTypes.message, vehicleTypes.data));
    return;
  } catch (error: any) {
   
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}

// Update Vehicle Type
async function updateVehicleTypeController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
   

    const { id,vehicletype, max_weight } = req.body;

    let updatedVehicleType: any = await vehicleTypeObj.updateVehicleType(id, vehicletype, max_weight);

    if (updatedVehicleType.error) {
      res.send(functionsObj.output(0, updatedVehicleType.message));
      return;
    }

    res.send(functionsObj.output(1, updatedVehicleType.message, updatedVehicleType.data));
    return;
  } catch (error: any) {
    
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}

// Delete Vehicle Type
async function deleteVehicleTypeController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const { id } = req.body;

    const vehicletype: any = await vehicleTypeObj.getVehicleTypeById(id);
        if (!vehicletype || !vehicletype.data) {
          res.status(404).send(functionsObj.output(0,vehicletype.message));
          return;
        }
        let imageUrl = vehicletype.data.vehicletype_img;
        if (imageUrl) {
          const publicId = extractPublicIdFromUrl(imageUrl);
          if (publicId) {
           await deleteFromCloudinary(publicId);
          } 
        }

    let deletedVehicleType: any = await vehicleTypeObj.deleteVehicleType(id);

    if (deletedVehicleType.error) {
      res.send(functionsObj.output(0, deletedVehicleType.message));
      return;
    }

    res.send(functionsObj.output(1, deletedVehicleType.message,deletedVehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, error.message, error));
    return;
  }
}