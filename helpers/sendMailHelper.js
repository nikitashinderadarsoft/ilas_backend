const axios = require("axios");
const { logEmailHistory } = require("./notificationLogger");

const http = require("http");
const https = require("https");
const agent = new https.Agent({
  family: 4, // force IPv4
});

const sendMailCallApi = async ({
  email,
  name,
  //orderid,
  //datebooking,
  //qr_link,
  pdf_link,
}) => {
  try {
    const url = "https://control.msg91.com/api/v5/email/send";
    const templateId = "acetech_2026";

    const data = {
      recipients: [
        {
          to: [
            {
              email: email,
              name: name,
            },
          ],
          variables: {
            name,
            event_name:
              "ACETECH Bengaluru 2026 - Architecture, Design & Building Innovation Expo",
            address: "Bangalore International Exhibition Centre",
            //datetime: "9th, 10th & 11th October 2026",
            badge_validity: "9th, 10th & 11th October 2026",
            //orderid,
            //date: datebooking,
            //qr_link,
            pdf_link,
          },
        },
      ],
      from: {
        name: "Registrations - AceTech",
        email: "registrations@gathrr.in",
      },
      domain: "gathrr.in",
      template_id: templateId,
      validate_before_send: true,
    };

    const variables = data.recipients?.[0]?.variables || {};

    console.log("PDF LINK:", pdf_link);
    console.log("EMAIL:", email);
    console.log("VARIABLES:", variables);

    const response = await axios.post(url, data, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authkey: "481362ATMX0qvI7ZT6932bcd1P1",
      },
      httpsAgent: agent,
    });

    logEmailHistory({
      to: email,
      templateId,
      variables,
      status: "SUCCESS",
      provider: "MSG91",
      providerResponse: response.data,
      payload: data,
    });

    return response.data;
  } catch (error) {
    logEmailHistory({
      to: email,
      templateId: "acetech_2026",
      variables: {
        name,
        // orderid,
        // date: datebooking,
        // qr_link,
         pdf_link,
      },
      status: "FAILED",
      provider: "MSG91",
      providerResponse: error.response?.data,
      error,
      payload: {
        email,
        name,
        // orderid,
        // datebooking,
        // qr_link,
         pdf_link,
      },
    });
    throw error;
  }
};

module.exports = { sendMailCallApi };
