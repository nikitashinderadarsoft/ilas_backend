const { applyQueryOptions } = require("../../helpers/query");
const businessVisitorModel = require("../../models/BusinessVisitor");
const exhibitorInviteeModel = require("../../models/ExhibitorInvitee");
const LeadModel = require("../../models/Lead");
const rsvpModel = require("../../models/Rsvp");
const UserModel = require("../../models/User");
const vipModel = require("../../models/Vip");
const visitorModel = require("../../models/Visitor");

const createLead = async (req, res) => {
  const { name, email, phone, note, exhibitorId, bookingNo } = req.body;

  try {
    const existingLead = await LeadModel.findOne({ bookingNo, exhibitorId });

    if (existingLead) {
      return res.status(200).json({ message: "Lead already generated.", data: existingLead });
    }

    const newLead = new LeadModel({
      name,
      email,
      phone,
      note,
      exhibitorId,
      bookingNo,
    });

    const savedLead = await newLead.save();
    res.status(200).json({ message: "Lead generated successfully.", data: savedLead });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getLeads = async (req, res) => {
  const { exhibitorId } = req.query;

  const baseMatch = {};

  if (exhibitorId) {
    baseMatch.exhibitorId = exhibitorId;
  }

  try {
    const response = await applyQueryOptions({ model: LeadModel, baseMatch, req });

    let leadsArray = response.data || response.docs || [];

    const bookingNos = [...new Set(leadsArray.map((lead) => lead.bookingNo))].filter(Boolean);

    if (bookingNos.length > 0) {
      const query = { booking_no: { $in: bookingNos } };

      const [generals, businesses, vips, rsvps, exhibitors] = await Promise.all([
        visitorModel.find(query).lean(),
        businessVisitorModel.find(query).lean(),
        vipModel.find(query).lean(),
        rsvpModel.find(query).lean(),
        exhibitorInviteeModel.find(query).lean(),
      ]);

      const allVisitors = [
        ...generals.map((v) => ({ ...v, roleType: "GENERAL VISITOR" })),
        //...businesses.map((v) => ({ ...v, roleType: "BUSINESS VISITOR" })),
        ...vips.map((v) => ({ ...v, roleType: "VIP" })),
        ...rsvps.map((v) => ({ ...v, roleType: "RSVP" })),
        ...exhibitors.map((v) => ({ ...v, roleType: "EXHIBITOR INVITEE" })),
      ];

      const visitorMap = {};
      allVisitors.forEach((v) => {
        visitorMap[v.booking_no] = v;
      });

      leadsArray = leadsArray.map((lead) => {
        const leadObj = typeof lead.toObject === "function" ? lead.toObject() : lead;
        return {
          ...leadObj,
          visitorDetails: visitorMap[leadObj.bookingNo] || null,
        };
      });

      if (response.data) response.data = leadsArray;
      if (response.docs) response.docs = leadsArray;
    }

    return res.status(200).json({
      ...response,
      message: "Leads fetched successfully.",
    });
  } catch (error) {
    console.error("Fetch Leads Error:", error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createLead,
  getLeads,
};
