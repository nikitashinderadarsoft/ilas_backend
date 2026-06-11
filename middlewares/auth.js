const jwt = require("jsonwebtoken");
const UserModel = require("../models/User");

const messages = {
  userNotFound: "User not found.",
  noToken: "No token, authorization denied",
  invalidTokenFormat: "Invalid token format",
  tokenExpired: "Session has expired.",
};

const authenticate = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return next({ status: 401, message: messages.noToken });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return next({ status: 401, message: messages.invalidTokenFormat });

  const token = parts[1];

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next({ status: 401, message: messages.tokenExpired });
    }
    const user = await UserModel.findById(decoded.user.id);
    if (!user) return next({ status: 401, message: messages.userNotFound });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };