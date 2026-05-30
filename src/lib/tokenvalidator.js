import jwt from "jsonwebtoken";

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
    console.log(err, "errrrrrrrrr");
    throw new Error("Invalid access token");
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
    console.log(err, "errrrrrrrrr");
    throw new Error("Invalid access token");
  }

  return payload;
};
