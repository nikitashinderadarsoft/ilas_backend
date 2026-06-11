const csv = require("csvtojson");
const xlsx = require("xlsx");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const QRCode = require("qrcode");
const { applyQueryOptions } = require("../../helpers/query");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const exhibitorInviteeModel = require("../../models/ExhibitorInvitee");
const visitorModel = require("../../models/Visitor");
const businessVisitorModel = require("../../models/BusinessVisitor");
const { generatePassword } = require("../../helpers/utils");
const { generateInviteUrlQr } = require("../../scripts");
const { generateCoupons } = require("../../helpers/exhibitorCoupon");
const dotenv = require("dotenv").config();
const ExhibitorCoupon = require("../../models/ExhibitorCoupon");

const createNewUser = async (req, res) => {
  try {
    const {
      full_name,
      name,
      email,
      phone,
      country_code,
      country,
      company_name,
      company_email,
      company_phone,
      company_phone_code,
      invitee_limit,
      stall_size,
    } = req.body;

    const formattedEmail = String(email).toLowerCase().trim();

    //  Duplicate check
    const existingUser = await User.findOne({
      $or: [{ email: formattedEmail }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        status: false,
        message: existingUser.email === formattedEmail ? "Email already exists" : "Phone already exists",
      });
    }

    const plainPassword = await generatePassword(6);

    const newUser = new User({
      full_name: (full_name || name || "").trim(),
      email: formattedEmail,
      phone: phone ? String(phone).trim() : null,
      country: country || "India",
      country_code: country_code || "+91",
      company_name: company_name || null,
      company_email: company_email || null,
      company_phone: company_phone || null,
      company_phone_code: company_phone_code || null,
      invitee_limit: Number(invitee_limit) || 100,
      role: "exhibitor",
      password: plainPassword,
      user_pwd: plainPassword,
      stall_size: Number(stall_size) || 0,
    });

    //  Save
    await newUser.save();
    const userId = newUser._id;

    await generateInviteUrlQr(userId);

    await generateCoupons(
      userId,
      Number(invitee_limit) || 100
    );

    return res.status(201).json({
      status: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const getUser = async (req, res, next) => {
  try {
    const { roles } = req.body;
    const response = await applyQueryOptions({
      model: User,
      req,
      searchFields: ["full_name", "email", "phone"],
      baseMatch: roles ? { role: { $in: roles } } : {},
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error("Get User Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: user,
    });
  } catch (err) {
    console.error("Get User by ID Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

const importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "CSV file required",
      });
    }

    const rows = await csv().fromString(req.file.buffer.toString("utf8"));

    if (!rows.length) {
      return res.status(400).json({
        status: false,
        message: "CSV is empty",
      });
    }

    // Remove duplicate emails from CSV
    const uniqueMap = new Map();

    rows.forEach((r) => {
      if (!r.email) return;

      const email = String(r.email).toLowerCase().trim();

      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, r);
      }
    });

    const uniqueRows = Array.from(uniqueMap.values());

    //  Check duplicates in DB
    const emails = uniqueRows.map((r) => String(r.email).toLowerCase().trim());

    const existingUsers = await User.find({
      email: { $in: emails },
    }).select("email");

    const existingSet = new Set(existingUsers.map((u) => u.email));

    // Filter new users only
    const newUsers = await Promise.all(
      uniqueRows
        .filter((r) => !existingSet.has(String(r.email).toLowerCase().trim()))
        .map(async (r) => {
          const plainPassword = await generatePassword(6);

          return {
            full_name: (r.full_name || r.name || "").trim(),
            email: String(r.email).toLowerCase().trim(),
            phone: r.phone ? String(r.phone).trim() : null,
            country: r.country || "India",
            country_code: r.country_code || "+91",
            company_name: r.company_name || null,
            company_email: r.company_email || null,
            company_phone: r.company_phone || null,
            company_phone_code: r.company_phone_code || null,
            invitee_limit: Number(r.invitee_limit) || 100,
            stall_size: Number(r.stall_size) || 0,
            role: "exhibitor",

            password: plainPassword, // stored in DB
            user_pwd: plainPassword, // for email/SMS
          };
        }),
    );
    // Insert only new users
    const result = await User.insertMany(newUsers);
    // loop all users
    for (const user of result) {
      if (user.role === "exhibitor") {
        const userId = user._id;

        const qrData = `${process.env.FRONTEND_BASE_URL}/register/exhibitor-invitee/exhibitor-invitee-link?id=${userId}`;

        const qrBuffer = await QRCode.toBuffer(qrData, {
          type: "png",
          width: 600,
        });

        const qrUpload = await uploadBufferToS3({
          buffer: qrBuffer,
          originalname: `${userId}.png`,
          mimetype: "image/png",
          context: "EXHIBITOR_QR",
          createFileRecord: false,
          isPublic: true,
        });

        const qrUrl = qrUpload.url;

        // update user
        await User.findByIdAndUpdate(userId, {
          invite_url: qrData,
          invite_url_qr: qrUrl,
        });
      }
    }

    return res.json({
      status: true,
      message: "Import completed",
      total_csv: rows.length,
      unique_csv: uniqueRows.length,
      skipped_db_duplicates: existingUsers.length,
      inserted: result.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    //  Validation
    if (!email || !password) {
      return next({
        status: false,
        message: "Email and password are required.",
      });
    }

    //  Find User
    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password +role");

    if (!user) {
      return next({
        status: false,
        message: "Invalid email or password.",
      });
    }

    //  Role Check
    const allowedRoles = ["super_admin", "admin", "exhibitor"];
    if (!allowedRoles.includes(user.role)) {
      return next({
        status: false,
        message: "Access denied!",
      });
    }

    //  Password Match
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("isMatch, user.password", isMatch, user.password);
    if (!isMatch) {
      return next({
        status: false,
        message: "Invalid email or password.",
      });
    }

    //  JWT Token
    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "12d",
    });

    //  Convert to Object
    let responseData = user.toObject();

    //  Remove sensitive data
    delete responseData.password;

    responseData.invite_url = responseData.invite_url || null;

    //  Final Response
    return res.status(200).json({
      status: true,
      message: "Login successfully.",
      data: responseData,
      token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return next({
      status: false,
      message: error.message || "Something went wrong.",
    });
  }
};

const tokenBlacklist = new Set();

const logoutUser = (req, res) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(400).json({ status: false, message: "Token required." });

  tokenBlacklist.add(token);
  res.status(200).json({ status: true, message: "Logout successful." });
};

const updateUserProfile = async (req, res) => {
  try {
    const { user_id, full_name, country, company_name, company_email, company_phone, invitee_limit, stall_size } = req.body;

    // find user
    const user = await User.findById({ _id: user_id });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // update fields
    if (full_name) user.full_name = full_name.trim();
    if (country) user.country = country;
    if (company_name !== undefined) user.company_name = company_name || null;
    if (company_email !== undefined) user.company_email = company_email || null;
    if (company_phone !== undefined) user.company_phone = company_phone || null;
    if (invitee_limit !== undefined) {
      const oldLimit = user.invitee_limit || 0;
      const newLimit = Number(invitee_limit);

     if (newLimit < oldLimit) {
        return res.status(400).json({
          status: false,
          message: `Invitee limit cannot be less than ${oldLimit}`,
        });
      }

      if (newLimit > oldLimit) {
        const difference = newLimit - oldLimit;

        await generateCoupons(
          user._id,
          difference
        );
      }

      user.invitee_limit = newLimit;
    }
    if (stall_size !== undefined) user.stall_size = Number(stall_size) || 0;

    await user.save();

    return res.status(200).json({
      status: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const dashboardStats = async (req, res) => {
  try {
    const { role } = req.user;
    let stats = {};

    if (role === "super_admin") {
      stats.total_users = await User.countDocuments();
      stats.total_exhibitors = await User.countDocuments({ role: "exhibitor" });
      stats.total_admins = await User.countDocuments({ role: "admin" });
    } else if (role === "admin") {
      stats.total_exhibitors = await User.countDocuments({ role: "exhibitor" });
      stats.successful_bookings = await visitorModel.countDocuments({
        payment_status: "SUCCESS",
      });
      stats.approved_bookings = await businessVisitorModel.countDocuments({
        booking_status: "approved",
      });
    } else if (role === "exhibitor") {
      stats.invitees_count = await exhibitorInviteeModel.countDocuments({
        exhibitor_id: req.user._id,
      });
      stats.total_invitees = req.user.invitee_limit || 0;
    }

    return res.status(200).json({
      status: true,
      message: "Dashboard stats retrieved successfully.",
      data: stats,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong.",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      status: true,
      data: user,
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

//get all exhibotors coupons
const getAllExhibitorCoupons = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    const {
      status,
      exhibitor_id,
      search,
    } = req.body;

    const query = {};

    if (exhibitor_id) {
      query.exhibitor_id = exhibitor_id;
    }

    if (status === "used") {
      query.is_used = true;
    }

    if (status === "unused") {
      query.is_used = false;
    }

    if (search) {
      query.coupon_code = {
        $regex: search,
        $options: "i",
      };
    }

    const coupons = await ExhibitorCoupon.find(query)
      .populate(
        "exhibitor_id",
        "full_name email company_name"
      )
      .populate(
        "used_by",
        "full_name email"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

//get exhibitor coupons by exhibitor id
const getExhibitorCoupons = async (req, res) => {
  try {
    const { exhibitor_id } = req.params;
    const { status } = req.query;

    const query = {
      exhibitor_id,
    };

    if (status === "used") {
      query.is_used = true;
    }

    if (status === "unused") {
      query.is_used = false;
    }

    const coupons = await ExhibitorCoupon.find(query)
      .sort({ createdAt: -1 });

    const stats = {
      total: await ExhibitorCoupon.countDocuments({
        exhibitor_id,
      }),

      used: await ExhibitorCoupon.countDocuments({
        exhibitor_id,
        is_used: true,
      }),

      unused: await ExhibitorCoupon.countDocuments({
        exhibitor_id,
        is_used: false,
      }),
    };

    return res.status(200).json({
      status: true,
      stats,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  importUsers,
  createNewUser,
  getUser,
  getUserById,
  updateUserProfile,
  loginUser,
  logoutUser,
  dashboardStats,
  getProfile,
  getAllExhibitorCoupons,
  getExhibitorCoupons,
};
