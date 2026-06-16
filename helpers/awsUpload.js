const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");

const FileModel = require("../models/File");
const { FILE_CONTEXTS } = require("../utils/constants");

dotenv.config();

const MAX_FILE_SIZE = (Number(process.env.MAX_FILE_SIZE) || 5) * 1024 * 1024;
const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const USE_OBJECT_ACL = String(process.env.AWS_S3_USE_ACL || "false") === "true";

if (!BUCKET_NAME) {
  console.error("CRITICAL ERROR: AWS_S3_BUCKET is not defined in environment variables.");
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadToS3 = async ({
  file,
  context = "DEFAULT",
  prefix = "ilas",
  createFileRecord = true,
  ownerId,
  uploadedBy,
  isPublic = true,
  maxSize = MAX_FILE_SIZE,
}) => {
  if (!file) throw new Error("File is required");
  if (!context) throw new Error("File context is required");

  const isValidContext = Object.prototype.hasOwnProperty.call(FILE_CONTEXTS, context);
  if (!isValidContext) {
    throw new Error(`Invalid file context '${context}'. Use a FILE_CONTEXTS key.`);
  }

  if (file.size > maxSize) {
    throw new Error(`File too large. Max size allowed is ${maxSize / (1024 * 1024)}MB`);
  }

  const fileId = new mongoose.Types.ObjectId();
  const ext = path.extname(file.originalname);
  const timestamp = Date.now();

  const contextPath = FILE_CONTEXTS[context];

  const key = `${prefix}/${contextPath}/${timestamp}-${fileId}${ext}`;

  const putParams = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  if (USE_OBJECT_ACL) {
    putParams.ACL = isPublic ? "public-read" : "private";
  }

  await s3.send(new PutObjectCommand(putParams));

  const fileDoc = {
    _id: fileId,
    bucket: BUCKET_NAME,
    key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    context,
    ownerId,
    isPublic,
    createdBy: uploadedBy,
    isDeleted: false,
  };

  if (createFileRecord) {
    await FileModel.create(fileDoc);
  }

  return fileDoc;
};

const getS3PublicUrl = ({ bucket, key, region = process.env.AWS_REGION }) => {
  if (!bucket || !key) return null;

  if (!region || region === "us-east-1") {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

const uploadBufferToS3 = async ({
  buffer,
  originalname,
  mimetype,
  context = "DEFAULT",
  prefix = "ilas",
  createFileRecord = true,
  ownerId,
  uploadedBy,
  isPublic = true,
  maxSize = MAX_FILE_SIZE,
}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Buffer is required for uploadBufferToS3");
  }

  const file = {
    buffer,
    size: buffer.length,
    originalname,
    mimetype,
  };

  const fileDoc = await uploadToS3({
    file,
    context,
    prefix,
    createFileRecord,
    ownerId,
    uploadedBy,
    isPublic,
    maxSize,
  });

  return {
    ...fileDoc,
    url: getS3PublicUrl({ bucket: fileDoc.bucket, key: fileDoc.key }),
  };
};

const generateReadUrl = async ({ file, bucket, key, expiresIn = 900 }) => {
  try {
    const finalBucket = bucket || file?.bucket || process.env.AWS_S3_BUCKET;
    const finalKey = key || file?.key;

    if (!finalBucket || !finalKey) {
      console.warn("S3: Missing bucket or key for file", file?._id);
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: finalBucket,
      Key: finalKey,
    });

    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error("S3 Presigned URL Error:", error.message);
    return null;
  }
};

module.exports = {
  upload,
  uploadToS3,
  uploadBufferToS3,
  generateReadUrl,
  getS3PublicUrl,
};

