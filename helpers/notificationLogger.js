const EmailHistoryModel = require("../models/EmailHistory");
const WhatsAppHistoryModel = require("../models/WhatsAppHistory");

const maskEmail = (email = "") => {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "";
  }

  const [name, domain] = email.split("@");
  const visibleName = name.slice(0, 2);
  return `${visibleName}***@${domain}`;
};

const maskPhone = (phone = "") => {
  const value = String(phone || "").replace(/\D/g, "");
  if (!value) return "";
  if (value.length <= 4) return value;
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
};

const getErrorMessage = (error) => {
  if (!error) return "Unknown error";
  const responseData = error.response?.data;
  if (typeof responseData === "string") return responseData;
  if (responseData) return JSON.stringify(responseData);
  return error.message || "Unknown error";
};

const saveHistory = (Model, data, prefix) => {
  try {
    Model.create(data).catch((saveError) => {
      console.error(`${prefix} history save failed:`, saveError.message);
    });
  } catch (loggerError) {
    console.error(`${prefix} logger failed:`, loggerError.message);
  }
};

const logEmailHistory = ({
  to,
  templateId,
  variables = {},
  status,
  referenceId,
  referenceModel,
  provider = "MSG91",
  providerResponse,
  error,
  errorMessage,
  payload,
}) => {
  const finalErrorMessage =
    errorMessage || (error ? getErrorMessage(error) : undefined);

  saveHistory(
    EmailHistoryModel,
    {
      to,
      templateId,
      variables,
      status,
      referenceId,
      referenceModel,
      provider,
      providerResponse,
      errorMessage: finalErrorMessage,
      payload,
    },
    "Email",
  );
};

const logWhatsAppHistory = ({
  to,
  templateId,
  variables = {},
  status,
  referenceId,
  referenceModel,
  provider = "AISENSY",
  providerResponse,
  error,
  errorMessage,
  payload,
}) => {
  const finalErrorMessage =
    errorMessage || (error ? getErrorMessage(error) : undefined);

  saveHistory(
    WhatsAppHistoryModel,
    {
      to,
      templateId,
      variables,
      status,
      referenceId,
      referenceModel,
      provider,
      providerResponse,
      errorMessage: finalErrorMessage,
      payload,
    },
    "WhatsApp",
  );
};

module.exports = {
  logEmailHistory,
  logWhatsAppHistory,
  maskEmail,
  maskPhone,
};
