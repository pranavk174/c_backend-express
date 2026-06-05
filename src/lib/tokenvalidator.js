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
    console.log(err, "errrrrrrrrr in validate token");
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
    console.log(err, "errrrrrrrrr in validate cookie");
    throw new Error("Unauthorized");
  }

  return payload;
};

export const generateTokens = (user, email, device_id) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
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
      userId: user.id,
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
