const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const crypto = require("crypto");
const UserModel = require("../models/User");

dayjs.extend(utc);

/**
 * Backend-safe date formatter
 *
 * @param {string|Date|number} date
 * @param {object} options
 * @param {string} [options.inputFormat]
 * @param {string} [options.outputFormat="YYYY-MM-DD"]
 * @param {boolean} [options.useUTC=true]
 * @param {string} [options.fallback=""]
 * @returns {string}
 */
const formatDate = (date, options = {}) => {
  const { inputFormat, outputFormat = "YYYY-MM-DD", useUTC = true, fallback = "" } = options;

  if (!date) return fallback;

  const parsed = inputFormat ? dayjs(date, inputFormat) : useUTC ? dayjs.utc(date) : dayjs(date);

  return parsed.isValid() ? parsed.format(outputFormat) : fallback;
};

/**
 * Flexible time formatter
 *
 * @param {number} seconds - Total time in seconds
 * @param {object} options
 * @param {boolean} [options.showHours=false]
 * @returns {string}
 */
const formatTime = (seconds, { showHours = false } = {}) => {
  if (seconds == null || isNaN(seconds)) return "00:00";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [showHours ? hrs.toString().padStart(2, "0") : null, mins.toString().padStart(2, "0"), secs.toString().padStart(2, "0")]
    .filter(Boolean)
    .join(":");
};

/**
 * Sanitize text into human-readable format
 *
 * Examples:
 *  close-ended        => "Close Ended"
 *  close_ended        => "Close Ended"
 *  closeEnded         => "Close Ended"
 *  CLOSE_ENDED        => "Close Ended"
 *
 * @param {string} text
 * @param {object} options
 * @param {boolean} options.capitalizeFirst   Capitalize only first letter
 * @param {boolean} options.capitalizeWords   Capitalize each word (default)
 * @param {boolean} options.lowercase         Force lowercase
 * @param {boolean} options.uppercase         Force uppercase
 * @param {string}  options.separator         Custom separator (default: space)
 * @param {object}  options.acronyms          Preserve acronyms (e.g. { id: "ID" })
 *
 * @returns {string}
 */
const sanitizeText = (text, options = {}) => {
  if (!text || typeof text !== "string") return "";

  const { capitalizeFirst = false, capitalizeWords = true, lowercase = false, uppercase = false, separator = " ", acronyms = {} } = options;

  let result = text
    // Replace separators with space
    .replace(/[_\-]+/g, " ")

    // Split camelCase / PascalCase
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")

    // Normalize spaces
    .replace(/\s+/g, " ")
    .trim();

  // Apply casing rules
  if (uppercase) {
    result = result.toUpperCase();
  } else if (lowercase) {
    result = result.toLowerCase();
  } else {
    result = result.toLowerCase();

    if (capitalizeWords) {
      result = result.replace(/\b\w/g, (c) => c.toUpperCase());
    } else if (capitalizeFirst) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
  }

  // Apply acronym overrides
  if (Object.keys(acronyms).length) {
    result = result
      .split(" ")
      .map((word) => acronyms[word.toLowerCase()] || word)
      .join(separator);
  } else {
    result = result.split(" ").join(separator);
  }

  return result;
};

const genOtp = (len = 4) => String(Math.floor(Math.random() * 10 ** len)).padStart(len, "0");
const genSlug = (len = 21) => {
  return crypto
    .randomBytes(Math.ceil(len * 0.75)) // base64 expands size
    .toString("base64url") // URL-safe
    .slice(0, len);
};
const isEmail = (s) => typeof s === "string" && s.includes("@");

const sessionPasswords = new Set();

const generatePassword = async (length = 6) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let password = "";

  while (!isUnique) {
    password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (sessionPasswords.has(password)) {
      continue;
    }

    const existingUser = await UserModel.findOne({ user_pwd: password }).lean();

    if (!existingUser) {
      isUnique = true;
      sessionPasswords.add(password);
    }
  }

  return password;
};

const generateBadgeUrl = (bookingId) => {
  const baseUrl = process.env.BASE_URL || "https://api.ihff.asia";
  return `${baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"}badge/${bookingId}`;
};

module.exports = {
  formatDate,
  formatTime,
  sanitizeText,
  genOtp,
  genSlug,
  isEmail,
  generatePassword,
  generateBadgeUrl,
};
