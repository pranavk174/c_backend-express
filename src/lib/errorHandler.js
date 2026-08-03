import { GraphQLError } from "graphql";

export class AppError extends GraphQLError {
  constructor({
    message,
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    details = null,
    cause = null,
  }) {
    super(message, {
      extensions: {
        status,
        code,
        details,
        stack: cause?.stack ?? null,
      },
    });
  }
}
