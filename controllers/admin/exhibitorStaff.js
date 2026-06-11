const QRCode = require("qrcode");
const ExhibitorStaff = require("../../models/ExhibitorStaff");
const User = require("../../models/User");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");

// CREATE STAFF
const createExhibitorStaff = async (req, res, next) => {
  try {
    const {
      full_name,
      display_name,
      email,
      phone,
      country_code,
      country,
    } = req.body;

    // req.user is set by your auth middleware
    const createdById = req.user._id;
    const createdByRole = req.user.role; // "EXHIBITOR" or "ADMIN"
    const createdByName = req.user.full_name;

    // If admin, exhibitor_id can be passed in body, else use logged in user's _id
    const exhibitor_id = req.user.role === "admin"
      ? req.body.exhibitor_id 
      : req.user._id;

      if (!exhibitor_id) {
        return res.status(400).json({
          status: false,
          message: "exhibitor_id is required",
        });
      }

    // Duplicate check
    const existing = await ExhibitorStaff.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        status: false,
        message: existing.email === email ? "Email already exists" : "Phone already exists",
      });
    }

    // Verify exhibitor exists
    const exhibitor = await User.findById(exhibitor_id);
    if (!exhibitor) {
      return res.status(404).json({ status: false, message: "Exhibitor not found" });
    }

    // LIMIT CHECK — count existing (non-deleted) staff for this exhibitor
    const staffCount = await ExhibitorStaff.countDocuments({
      exhibitor_id,
      is_deleted: false,
    });

    if (exhibitor.invitee_limit && staffCount >= exhibitor.invitee_limit) {
      return res.status(400).json({
        status: false,
        message: `Staff limit reached. This exhibitor can only have ${exhibitor.invitee_limit} staff member(s).`,
      });
    }

    // Generate staff number
    const staff_no = "STAFF-" + Date.now();

    // Create staff record first to get _id
    const staff = await ExhibitorStaff.create({
      staff_no,
      exhibitor_id,
      created_by: {
        id: createdById,
        name: createdByName,
        role: createdByRole,
      },
      full_name,
      display_name,
      email,
      phone,
      country_code,
      country,
    });

    // Generate QR
    const qrData = JSON.stringify({
      staff_id: staff._id,
      staff_no,
      name: full_name,
      email,
      phone,
      role: "EXHIBITOR STAFF",
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 400,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${staff._id}.png`,
      mimetype: "image/png",
      context: "EXHIBITOR_STAFF_QR",
      isPublic: true,
    });

    staff.qr_url = qrUpload.url;
    await staff.save();

    return res.status(201).json({
      status: true,
      message: "Staff created successfully",
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL STAFF (for exhibitor → their own, for admin → all or by exhibitor_id)
const getExhibitorStaff = async (req, res, next) => {
  try {
    const { exhibitor_id } = req.params;
    const { search } = req.query;
    const requestingRole = req.user.role;

    let query = {
      is_deleted: false,
    };
    
    if (requestingRole === "admin"  && exhibitor_id) {
      // Admin can filter by exhibitor_id or get all
      if (exhibitor_id) query.exhibitor_id = exhibitor_id;
    }

       if (search) {
      const exhibitors = await User.find({
        full_name: { $regex: search, $options: "i" },
      }).select("_id");

      const exhibitorIds = exhibitors.map((e) => e._id);

      query.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { display_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { staff_no: { $regex: search, $options: "i" } },
        { exhibitor_id: { $in: exhibitorIds } },
      ];
    }


  
    //populate exhibitor name and email from User
    const staffList = await ExhibitorStaff.find(query)
      .populate("exhibitor_id", "full_name email") // ← add this
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      message: "Staff fetched successfully",
      data: staffList,
    });
  } catch (error) {
    next(error);
  }
};

const getExhibitorStaffById = async (req, res, next) => {
  try {
    const { staff_id } = req.params;

    const staff = await ExhibitorStaff.findOne({
      _id: staff_id,
      is_deleted: false,
    });

    if (!staff) {
      return res.status(404).json({ status: false, message: "Staff not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Staff fetched successfully",
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE STAFF
const updateExhibitorStaff = async (req, res, next) => {
  try {
    const { staff_id } = req.params;
    const { full_name, display_name, email, phone, country_code, country } = req.body;
    const requestingRole = req.user.role;

    const staff = await ExhibitorStaff.findOne({
      _id: staff_id,
      is_deleted: false,
    });

    if (!staff) {
      return res.status(404).json({ status: false, message: "Staff not found" });
    }

    // Exhibitor can only edit their own staff
    if (
      requestingRole === "EXHIBITOR" &&
      staff.exhibitor_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }

    // Check duplicate on update (exclude current staff)
    if (email || phone) {
      const duplicate = await ExhibitorStaff.findOne({
        _id: { $ne: staff_id },
        $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      });

      if (duplicate) {
        return res.status(400).json({
          status: false,
          message: duplicate.email === email ? "Email already exists" : "Phone already exists",
        });
      }
    }

    // Apply updates
    if (full_name) staff.full_name = full_name;
    if (display_name) staff.display_name = display_name;
    if (email) staff.email = email;
    if (phone) staff.phone = phone;
    if (country_code) staff.country_code = country_code;
    if (country) staff.country = country;

    // Regenerate QR if name/email/phone changed
    if (full_name || email || phone) {
      const qrData = JSON.stringify({
        staff_id: staff._id,
        staff_no: staff.staff_no,
        name: staff.full_name,
        email: staff.email,
        phone: staff.phone,
        role: "EXHIBITOR STAFF",
      });

      const qrBuffer = await QRCode.toBuffer(qrData, {
        type: "png",
        width: 400,
      });

      const qrUpload = await uploadBufferToS3({
        buffer: qrBuffer,
        originalname: `${staff._id}.png`,
        mimetype: "image/png",
        context: "EXHIBITOR_STAFF_QR",
        isPublic: true,
      });

      staff.qr_url = qrUpload.url;
    }

    await staff.save();

    return res.status(200).json({
      status: true,
      message: "Staff updated successfully",
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE STAFF
const deleteExhibitorStaff = async (req, res, next) => {
  try {
    const { staff_id } = req.params;
    const requestingRole = req.user.role;

    const staff = await ExhibitorStaff.findOne({
      _id: staff_id,
      is_deleted: false,
    });

    if (!staff) {
      return res.status(404).json({ status: false, message: "Staff not found" });
    }

    // Exhibitor can only delete their own staff
    if (
      requestingRole === "EXHIBITOR" &&
      staff.exhibitor_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }

    await ExhibitorStaff.findByIdAndUpdate(staff_id, {
      is_deleted: true,
    });

    return res.status(200).json({
      status: true,
      message: "Staff deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExhibitorStaff,
  getExhibitorStaff,
  updateExhibitorStaff,
  deleteExhibitorStaff,
  getExhibitorStaffById
};