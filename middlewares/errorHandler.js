const { validationResult } = require("express-validator");

const messages = {
  validationFailed: "Validation failed",
  serverError: "Server Error.",
};

const checkValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error(
      `${messages.validationFailed}: ${errors.array()?.[0].msg} ${
        errors.length > 1 ? `and ${errors.length - 1} more.` : ""
      }`
    );
    error.statusCode = 400;
    error.details = errors.array();
    throw error;
  }
};

const validateRequest = (req, res, next) => {
  try {
    checkValidation(req);
    next();
  } catch (err) {
    next(err);
  }
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || err.statusCode || 500).json({
    status: false,
    message: err.message || messages.serverError,
    stack: process.env.NODE_ENV === "development" ? err.stack : null
   
  });
};

module.exports = { errorHandler, checkValidation, validateRequest };
