import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dns from "dns";

import apiRoutes from "./routes/apiRoutes.js"; // <- renamed to reflect actual usage
import programSchema from "./models/Program.js";
import courseSchema from "./models/Course.js";
import moduleSchema from "./models/Module.js";
import finalQuizSchema from "./models/FinalQuiz.js";
import imageSchema from "./models/Image.js";

// Prefer IPv4 to avoid Node 22 + MongoDB Atlas DNS issues
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/templates", express.static("templates")); // serve certificates

const PORT = process.env.PORT || 4000;

// Common mongoose options
const mongooseOptions = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
};

const connections = {};
const models = {};

async function connectDbWithFallback(dbKey, dbName) {
  const srvUri = process.env.MONGO_URI_SRV;
  const nonSrvUri =
    process.env[`MONGO_URI_NONSRV_${dbKey.split("_")[0]}`] ||
    process.env.MONGO_URI_NONSRV;

  try {
    console.log(chalk.blue(`[${dbKey}] Attempting SRV connection...`));
    connections[dbKey] = await mongoose
      .createConnection(srvUri, { ...mongooseOptions, dbName })
      .asPromise();
    console.log(chalk.green(`[${dbKey}] Connected via SRV URI`));
  } catch (err) {
    console.warn(chalk.yellow(`[${dbKey}] SRV failed, trying non-SRV...`));
    connections[dbKey] = await mongoose
      .createConnection(nonSrvUri, { ...mongooseOptions, dbName })
      .asPromise();
    console.log(chalk.green(`[${dbKey}] Connected via non-SRV URI`));
  }

  models[dbKey] = {
    programs: connections[dbKey].model("Program", programSchema, "programs"),
    courses: connections[dbKey].model("Course", courseSchema, "courses"),
    modules: connections[dbKey].model("Module", moduleSchema, "modules"),
    final_quiz: connections[dbKey].model(
      "FinalQuiz",
      finalQuizSchema,
      "final_quiz"
    ),
    images: connections[dbKey].model("Image", imageSchema, "images"),
  };
}

async function setupConnections() {
  const dbConfigs = [
    { key: "AM_courses", name: "AM_courses" },
    { key: "OR_courses", name: "OR_courses" },
    { key: "EN_courses", name: "EN_courses" },
  ];
  await Promise.all(
    dbConfigs.map(({ key, name }) => connectDbWithFallback(key, name))
  );
}

// Start server
setupConnections()
  .then(() => {
    // ✅ Mount router correctly (no function call)
    app.use("/api", apiRoutes(models));

    // Root endpoint: simple overview
    app.get("/", (req, res) => {
      const endpoints = Object.keys(models)
        .map(
          (db) =>
            `<li>${db}: ${Object.keys(models[db])
              .map((col) => `<a href="/api/${db}/${col}">${col}</a>`)
              .join(", ")}</li>`
        )
        .join("");
      res.send(`<h1>API Endpoints</h1><ul>${endpoints}</ul>`);
    });

    app.listen(PORT, () => {
      console.log(chalk.magenta(`🚀 Server running on port ${PORT}`));
    });
  })
  .catch((err) => {
    console.error(chalk.red("DB connection failed:"), err);
    process.exit(1);
  });
