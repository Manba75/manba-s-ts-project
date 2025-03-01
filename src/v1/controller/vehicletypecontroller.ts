import express, { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import { dbVehicleType } from "../model/vehicletypemodel";
import { functions } from "../library/functions";
import Joi from "joi";
import { validations } from "../library/validations";

const router = express.Router();

router.post("/create", vehicleTypeValidation, createVehicleTypeController);
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

    const vehicleType: any = await vehicleTypeObj.insertVehicleType(vehicletype, max_weight, createdIp);

    if (!vehicleType.error) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_INSERT_ERROR", vehicleType.message));
      return;
    }

    res.send(functionsObj.output(1, "VEHICLE_TYPE_INSERT_SUCCESS", vehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "VEHICLE_TYPE_INSERT_ERROR", error));
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
// Get Vehicle Type by ID
async function getVehicleTypeByIdController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const { id } = req.body;

    const vehicleType: any = await vehicleTypeObj.getVehicleTypeById(id);

    if (!vehicleType) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "VEHICLE_TYPE_FETCH_SUCCESS", vehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "VEHICLE_TYPE_FETCH_ERROR", error));
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
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "VEHICLE_TYPES_FETCH_SUCCESS", vehicleTypes.data));
    return;
  } catch (error: any) {
   
    res.send(functionsObj.output(0, "VEHICLE_TYPES_FETCH_ERROR", error));
    return;
  }
}

// Update Vehicle Type
async function updateVehicleTypeController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
   

    const { id,vehicletype, max_weight } = req.body;

    const updatedVehicleType: any = await vehicleTypeObj.updateVehicleType(id, vehicletype, max_weight);

    if (updatedVehicleType.error) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "VEHICLE_TYPE_UPDATE_SUCCESS", updatedVehicleType.data));
    return;
  } catch (error: any) {
    
    res.send(functionsObj.output(0, "VEHICLE_TYPE_UPDATE_ERROR", error));
    return;
  }
}

// Delete Vehicle Type
async function deleteVehicleTypeController(req: Request, res: Response, next: NextFunction) {
  const functionsObj = new functions();
  const vehicleTypeObj = new dbVehicleType();
  try {
    const { id } = req.body;

    const deletedVehicleType: any = await vehicleTypeObj.deleteVehicleType(id);

    if (deletedVehicleType.error) {
      res.send(functionsObj.output(0, "VEHICLE_TYPE_NOT_FOUND"));
      return;
    }

    res.send(functionsObj.output(1, "VEHICLE_TYPE_DELETE_SUCCESS",deletedVehicleType.data));
    return;
  } catch (error: any) {
    res.send(functionsObj.output(0, "VEHICLE_TYPE_DELETE_ERROR", error));
    return;
  }
}