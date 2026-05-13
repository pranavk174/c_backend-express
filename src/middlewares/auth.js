import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    console.log(decoded, req.user, "req. user dataaaa.");

    next();
  } catch (error) {
    console.log(error, "errorrrrrr in middleware...");
    req.user = null;
    next();
  }
};
