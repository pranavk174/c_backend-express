import { ERROR } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { AppError } from "./errorHandler.js";


export const asyncGraphqlAPIHandeler =
  (resolver) => async (parent, input, context, info) => {
    try {
      return await resolver(parent, input, context, info);
    } catch (error) {
      logger.debug(error, "in get userssssssss");
      if (error.name === "ReferenceError") {
        throw new AppError(error.message, 500, "VARIABLE_ERROR", error.stack);
      }
      if (error.name === "TypeError") {
        throw new AppError(error.message, 500, "USER_NOT_FOUNd_ERROR");
      } if (error.name === "ZodError") {
        logger.debug(error.issues[0].message, "error in zod ")
        throw new AppError({
          message: error.issues[0].message, status: 400, code: "INPUT_VALIDATION_ERROR", detail: error.issues[0]
        })
      }
      throw error;
      //   throw new AppError(error.message, 404, "USER_NOT_FOUNd_ERROR");

      // return errorHandler(error.message, "INTERNAL_SERVER_ERROR", 500);
    }
  };

export const asyncHandeler = (method) => async (data) => {
  try {
    return await method(data);
  } catch (error) {
    throw new Error(error.message);
  }
};

export const asyncSocketAPIHandeler =
  (method) => async (socket, payload, data, callback) => {
    try {
      return await method(socket, payload, data, callback);
    } catch (error) {
      logger.debug(error);
      socket.emit(ERROR, error.message);
      return callback({
        success: false,
        error: error.message,
        status: 500,
      });
    }
  };
