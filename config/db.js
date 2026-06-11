const mongoose = require("mongoose");
const dns = require("node:dns");
const UserModel = require("../models/User");
const { sampleUserData } = require("../utils/constants");

if (process.env.NODE_ENV === "development") {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const initiateDB = async () => {
  const users = await UserModel.find();
  if (users.length === 0) {
    await UserModel.insertMany(sampleUserData);
    console.log("Sample user data inserted into the database.");
  }
};

const connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri);
    await initiateDB();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
