const axios = require("axios");
const { logWhatsAppHistory } = require("./notificationLogger");

/**
 * Registers an attendee for an AceTech event.
 *
 * @param {Object} attendeeData - The user data payload.
 * @returns {Promise<Object>} The API response containing message and userId.
 */
const sendDataToDashboard = async (attendeeData) => {
  return;
  const eventId = "69ca4c0818a529c1babbb3f9";
  const API_KEY = "rVX7e5R4hQJQ4LusbkenCDg9YoaHJh5B5FFPtmAoSnkbyVJ7Fm4iRfyyQMvnpTVQ";
  const BASE_URL = "https://app-server-63238821306.asia-south1.run.app";
  const endpoint = `${BASE_URL}/api/v1/ihff/registerAttendee/${eventId}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        origin: "https://ihff.asia",
      },
      body: JSON.stringify({ data: attendeeData }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${result.message || response.statusText}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Failed to register attendee:", error.message);
    throw error; // Re-throw if you want the calling function to handle it
  }
};

async function callApi({ to, lang = "en", params = [], templateId = "utitlitymessihff" }) {
  return;
  try {
    const data = {
      to: to,
      type: "template",
      template: {
        name: templateId,
        language: {
          policy: "deterministic",
          code: lang,
        },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({
              type: "text",
              text: p,
            })),
          },
        ],
      },
    };

    const config = {
      method: "post",
      url: "https://backend.aisensy.com/direct-apis/t1/messages",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhc3Npc3RhbnRJZCI6IjY4ZTM5YmFlNDQ1ODEzMTc0NmJhZWZkNiIsImNsaWVudElkIjoiNjhlMzliOThlNjc5YmEwZDc4ODkzY2MzIiwiaWF0IjoxNzU5OTI4NzY1fQ.iV0x9jd1AvbxSxNI_EpLRAkW5EiNkV8aIgAK8WDxYn4",
      },
      data: data,
    };

    const response = await axios(config);

    logWhatsAppHistory({
      to,
      templateId,
      variables: {
        lang,
        params,
      },
      status: "SUCCESS",
      provider: "AISENSY",
      providerResponse: response.data,
      payload: data,
    });

    return response.data;
  } catch (error) {
    logWhatsAppHistory({
      to,
      templateId,
      variables: {
        lang,
        params,
      },
      status: "FAILED",
      provider: "AISENSY",
      providerResponse: error.response?.data,
      error,
      payload: {
        to,
        lang,
        params,
      },
    });

    throw error;
  }
}

module.exports = { callApi, sendDataToDashboard };
