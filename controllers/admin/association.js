const AssociationModel = require("../../models/Association");
const AssociationVisitorModel = require("../../models/AssociationVisitor");

const addAssociation = async (req, res, next) => {
  try {
    const { name } = req.body;

    const newAssociation = new AssociationModel({ name });
    await newAssociation.save();

    return res.json({ status: true, data: newAssociation });
  } catch (error) {
    next(error);
  }
};

const getAllAssociations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, association_id } = req.query;

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (association_id) {
      query._id = association_id; // apply filter
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      AssociationModel.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean(),
      AssociationModel.countDocuments(query),
    ]);

    return res.json({ status: true, data, totalRecords: total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
};

const getAssociationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const association = await AssociationModel.findById(id).lean();
    if (!association) {
      return res.status(404).json({ status: false, message: "Association not found" });
    }

    return res.json({ status: true, data: association });
  } catch (error) {
    next(error);
  }
};

const updateAssociation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updated = await AssociationModel.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ status: false, message: "Association not found" });
    }

    return res.json({ status: true, data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteAssociation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await AssociationModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ status: false, message: "Association not found" });
    }

    return res.json({ status: true, message: "Association deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// get association visitors by particular id
const getAssociationVisitors = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, search } = req.query;

    const query = { association_id: id };

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company_name: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      AssociationVisitorModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AssociationVisitorModel.countDocuments(query),
    ]);

    return res.json({
      status: true,
      data,
      totalRecords: total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAssociation,
  getAllAssociations,
  getAssociationById,
  updateAssociation,
  deleteAssociation,
  getAssociationVisitors,
};