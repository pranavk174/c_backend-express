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

    console.log(payload, "paylod aaaaaaaaaaaa");
  } catch (err) {
    console.log(err, "errrrrrrrrr");
    throw new Error("Invalid refresh token");
  }

  return payload;
};
