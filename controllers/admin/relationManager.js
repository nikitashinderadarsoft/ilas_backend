const RelationManagerModel = require("../../models/RelationManager");
const { generateInviteUrlQr } = require("../../scripts");

const addRM = async (req, res, next) => {
  try {
    const { name } = req.body;

    const newRM = new RelationManagerModel({ name });
    await newRM.save();
    // Generate VIP invite URL + QR (visible on frontend)
    await generateInviteUrlQr(newRM._id, "vip-invitee", RelationManagerModel);
    // Generate RSVP invite URL + QR (reserved for future use; not shown on frontend now)
    await generateInviteUrlQr(newRM._id, "rsvp-invitee", RelationManagerModel);

    // Return the created RM with generated fields
    const saved = await RelationManagerModel.findById(newRM._id).lean();
    return res.json({ status: true, data: saved });
  } catch (error) {
    next(error);
  }
};

const getAllRMs = async (req, res, next) => {
  try {
    const { search } = req.query;

     let query = {
      isDeleted: false,
    };

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const rms = await RelationManagerModel.find(query)
    .sort({ name: 1 });
    res.json({ status: true, data: rms });
  } catch (error) {
    next(error);
  }
};

const getRMById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rm = await RelationManagerModel.findOne({ _id: id, isDeleted: false });
    if (!rm) {
      return res.status(404).json({ status: false, message: "Relation Manager not found" });
    }
    res.json({ status: true, data: rm });
  } catch (error) {
    next(error);
  }
};

const updateRM = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const rm = await RelationManagerModel.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    if (!rm) {
      return res.status(404).json({
        status: false,
        message: "Relation Manager not found",
      });
    }

    res.json({
      status: true,
      data: rm,
    });
  } catch (error) {
    next(error);
  }
};

const deleteRM = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rm = await RelationManagerModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!rm) {
      return res.status(404).json({
        status: false,
        message: "Relation Manager not found",
      });
    }

    res.json({
      status: true,
      message: "Relation Manager deleted successfully",
      data: rm,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { addRM, getAllRMs, getRMById, updateRM, deleteRM };
