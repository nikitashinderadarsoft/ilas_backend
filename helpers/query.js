const buildQueryOptions = ({
  body = {},
  searchFields = [],
  baseMatch = {},
  defaultSortBy = "_id",
}) => {
  const { search = "", page, limit, sortBy, order } = body;

  const match = { ...baseMatch };

  if (search && searchFields.length) {
    match.$or = searchFields.map((field) => ({
      [field]: { $regex: search, $options: "i" },
    }));
  }

  const sort = {
    [sortBy || defaultSortBy]: order === "asc" ? 1 : -1,
  };

  let pagination = {};
  let meta = null;

  if (page && limit) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    pagination = {
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
    };

    meta = { page: pageNum, limit: limitNum };
  }

  return { match, sort, pagination, meta };
};

const applyQueryOptions = async ({
  model,
  req,
  searchFields = [],
  baseMatch = {},
  aggregatePipeline = null, // if provided → aggregation
  projection = null,
  populate = null,
  defaultSortBy,
}) => {
  const { match, sort, pagination, meta } = buildQueryOptions({
    body: req.body,
    searchFields,
    baseMatch,
    defaultSortBy,
  });

  let data, total;

  if (aggregatePipeline) {
    // AGGREGATION FLOW
    const pipeline = [{ $match: match }, { $sort: sort }, ...aggregatePipeline];

    total =
      (
        await model.aggregate([
          { $match: match },
          ...aggregatePipeline,
          { $count: "count" },
        ])
      )[0]?.count || 0;

    if (pagination.skip !== undefined) {
      pipeline.push({ $skip: pagination.skip });
      pipeline.push({ $limit: pagination.limit });
    }

    data = await model.aggregate(pipeline);
  } else {
    // FIND FLOW
    total = await model.countDocuments(match);

    let query = model.find(match).sort(sort);

    if (projection) query = query.select(projection);
    if (populate) query = query.populate(populate);
    if (pagination.skip !== undefined) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }

    data = await query.exec();
  }

  const response = {
    status: true,
    data,
    totalRecords: total,
  };

  if (meta) {
    response.currentPage = meta.page;
    response.totalPages = Math.ceil(total / meta.limit);
  }

  return response;
};

module.exports = { buildQueryOptions, applyQueryOptions };
