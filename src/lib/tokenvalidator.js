import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";

export const errorHandler = (message, code, status) => {
  throw new GraphQLError(message, {
    extensions: {
      code,
      status,
    },
  });
};

export const validateToken = async (context) => {
  let payload;
  try {
    const cookie = await context.request.cookieStore?.get("accessToken");

    // console.log(cookie, "cookiessssss", context)
    // console.log(cookie, "cookies dataaaaa");
    if (!cookie) throw new Error("No refresh token");

    const accessToken = cookie.value;
    payload = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch (err) {
    // console.log(err.message, "errrrrrrrrr in validate token");

    // throw new Error(err.message || "Invalid Access token");
    return errorHandler(err.message, "Unauthenticated", 401);
  }

  return payload;
};

export const validateCookie = async (token) => {
  let payload;
  try {
    const cookie = token;

    // console.log(cookie, "cookiessssss", context)
    // console.log(cookie, "cookies dataaaaa");
    if (!cookie) throw new Error("No Access token");

    const accessToken = token;
    payload = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch (err) {
    // console.log(err, "errrrrrrrrr in validate cookie");

    // throw new Error(err.message || "Invalid Access token");
    throw new GraphQLError(err.message || "Invalid Access token", {
      extensions: {
        code: "UNAUTHORIZEDeeeee",
        http: { status: 401 }, // Sets HTTP status response
      },
    });
  }

  return payload;
};

export const generateTokens = (id, email, device_id) => {
  const accessToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const refreshToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
    },
    process.env.REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
};
