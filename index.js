require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { default: rateLimit } = require("express-rate-limit");
const { errorHandler } = require("./middlewares/errorHandler");
const { getBadge } = require("./controllers/visitor/visitor");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
});

const app = express();

// Connect DB
connectDB(process.env.MONGODB_URI || "");

// require("./scripts/index");

// Middlewares
app.use(limiter);
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.includes("/webhook-rzp")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }),
);
app.use(morgan("dev", { debug: true }));
app.use("/uploads", express.static("uploads"));

app.get("/badge/:userId", getBadge);
app.use("/api/admin", require("./routes/admin"));
app.use("/api/visitor", require("./routes/visitor"));

app.use("/ping", (req, res) =>
  res.json({
    status: true,
    message: "ILAS Backend",
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  }),
);

app.get("/", (req, res) => res.json({ status: true, message: "ILAS Backend" }));

app.use((req, res, next) => {
  next({ status: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
