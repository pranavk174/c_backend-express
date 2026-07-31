import { ERROR } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { errorHandler } from "./tokenvalidator.js";

export const asyncGraphqlAPIHandeler = (resolver) =>
    async (parent, input, context, info) => {
        try {
            return await resolver(parent, input, context, info)
        } catch (error) {
            logger.debug(error, "in get userssssssss");

            return errorHandler(error.message, "INTERNAL_SERVER_ERROR", 500);
        }

    }

export const asyncHandeler = (method) => async (data) => {
    try {
        return await method(data)
    } catch (error) {
        throw new Error(error.message)
    }
}

export const asyncSocketAPIHandeler = (method) => async (socket, payload, data, callback) => {
    try {
        return await method(socket, payload, data, callback)
    } catch (error) {
        logger.debug(error);
        socket.emit(ERROR, error.message);
        return callback({
            success: false,
            error: error.message,
            status: 500,
        });
    }
}