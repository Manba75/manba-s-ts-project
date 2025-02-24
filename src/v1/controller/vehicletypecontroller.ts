import express, { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import { dbVehicleType } from "../model/vehicletypemodel";
import { functions } from "../library/functions";
import Joi from "joi";
import { validations } from "../library/validations";

const router = express.Router();

var vehicleTypeObj = new dbVehicleType();
var functionsObj = new functions();
var validationsObj = new validations();

router.post("/create", vehicleTypeValidation, createVehicleTypeController);
router.get("/vehicletype/:id", getVehicleTypeByIdController);
router.get("/vehicletypes", getAllVehicleTypesController);
router.put("/update/:id", vehicleTypeValidation, updateVehicleTypeController);
router.put("/delete/:id", deleteVehicleTypeController);

module.exports = router;

// Vehicle Type schema validation
function vehicleTypeValidation(req: any, res: any, next: any) {
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

  if (!validationsObj.validateRequest(req, res, next, schema)) {
    return;
  }

  next();
}

// Create Vehicle Type
async function createVehicleTypeController(req: any, res: any, next: any) {
  try {
    const { vehicletype, max_weight } = req.body;
    const createdIp = requestIp.getClientIp(req) || "";

    const vehicleType: any = await vehicleTypeObj.insertVehicleType(
      vehicletype,
      max_weight,
      createdIp
    );

    if (!vehicleType.error) {
      return res.send(functionsObj.output(0, vehicleType.message));
    }

    return res.send(
      functionsObj.output(1, vehicleType.message, vehicleType.data)
    );
  } catch (error: any) {
    console.error("Error creating vehicle type:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Get Vehicle Type by ID
async function getVehicleTypeByIdController(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    if (!id || id === "0") {
      return res.send(functionsObj.output(0, "vehicletype ID is required"));
    }

    const vehicleType: any = await vehicleTypeObj.getVehicleTypeById(id);

    if (!vehicleType) {
      return res.send(functionsObj.output(0, vehicleType.message));
    }

    return res.send(
      functionsObj.output(1, vehicleType.message, vehicleType.data)
    );
  } catch (error: any) {
    console.error("Error fetching vehicle type:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Get all Vehicle Types
async function getAllVehicleTypesController(req: any, res: any, next: any) {
  try {
    const vehicleTypes: any = await vehicleTypeObj.getAllVehicleTypes();

    if (vehicleTypes.error || vehicleTypes.length === 0) {
      return res.send(functionsObj.output(0, vehicleTypes.message));
    }

    return res.send(
      functionsObj.output(1, vehicleTypes.message, vehicleTypes.data)
    );
  } catch (error: any) {
    console.error("Error fetching all vehicle types:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Update Vehicle Type
async function updateVehicleTypeController(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    if (!id || id === "0") {
      return res.send(functionsObj.output(0, "vehicletype ID is required"));
    }

    const { vehicletype, max_weight } = req.body;

    const updatedVehicleType: any = await vehicleTypeObj.updateVehicleType(
      id,
      vehicletype,
      max_weight
    );

    if (updatedVehicleType.error) {
      return res.send(functionsObj.output(0, updatedVehicleType.message));
    }

    return res.send(
      functionsObj.output(
        1,
        updatedVehicleType.message,
        updatedVehicleType.data
      )
    );
  } catch (error: any) {
    console.error("Error updating vehicle type:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}

// Delete Vehicle Type
async function deleteVehicleTypeController(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    if (!id || id === "0") {
      return res.send(functionsObj.output(0, "vehicletype ID is required"));
    }

    const deletedVehicleType: any = await vehicleTypeObj.deleteVehicleType(id);

    if (deletedVehicleType.error) {
      return res.send(functionsObj.output(0, deletedVehicleType.message));
    }

    return res.send(functionsObj.output(1, deletedVehicleType.message));
  } catch (error: any) {
    console.error("Error deleting vehicle type:", error);
    return res.send(functionsObj.output(0, "Internal server error", error));
  }
}
