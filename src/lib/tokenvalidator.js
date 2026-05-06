import jwt from "jsonwebtoken";

export const validateToken = async (context) => {
  let payload;
  try {
    const cookie = await context.request.cookieStore?.get("refreshToken");

    // console.log(cookie, "cookies dataaaaa");
    if (!cookie) throw new Error("No refresh token");

    const refreshToken = cookie.value;
    payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  } catch (err) {
    console.log(err, "errrrr");
    throw new Error("Invalid refresh token");
  }

  return payload;
};
