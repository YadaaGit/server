import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dns from "dns";

import createApiRoutes from "./routes/apiRoutes.js";
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

const PORT = process.env.PORT || 9174;

// Connection options reused for clarity & maintainability
const mongooseOptions = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
};

const connections = {};
const models = {};

/**
 * Connects to MongoDB using SRV URI, falls back to non-SRV if necessary
 * @param {string} dbKey - Unique key for the connection & models
 * @param {string} dbName - Mongo database name
 */
async function connectDbWithFallback(dbKey, dbName) {
  const srvUri = process.env.MONGO_URI_SRV;
  const nonSrvUri =
    process.env[`MONGO_URI_NONSRV_${dbKey.split("_")[0]}`] ||
    process.env.MONGO_URI_NONSRV;

  try {
    console.log(chalk.blue(`[${dbKey}] Attempting connection with SRV URI...`));
    connections[dbKey] = await mongoose
      .createConnection(srvUri, {
        ...mongooseOptions,
        dbName,
      })
      .asPromise();

    console.log(chalk.green(`[${dbKey}] Connected using SRV URI`));
  } catch (err) {
    console.warn(
      chalk.yellow(`[${dbKey}] SRV connection failed, trying non-SRV URI...`),
      err.message
    );
    connections[dbKey] = await mongoose
      .createConnection(nonSrvUri, {
        ...mongooseOptions,
        dbName,
      })
      .asPromise();
    console.log(chalk.green(`[${dbKey}] Connected using non-SRV URI`));
  }

  // Create models immediately after connection using new schemas
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

/**
 * Sets up all connections concurrently for faster startup
 */
async function setupConnections() {
  const dbConfigs = [
    { key: "AM_courses", name: "AM_courses" },
    { key: "OR_courses", name: "OR_courses" },
    { key: "EN_courses", name: "EN_courses" },
  ];

  // Run connections in parallel for faster startup
  await Promise.all(
    dbConfigs.map(({ key, name }) => connectDbWithFallback(key, name))
  );
}

// Main start function
setupConnections()
  .then(() => {
    // List of collections exposed by API
    const COLLECTION_NAMES = [
      "programs",
      "courses",
      "modules",
      "final_quiz",
      "images",
    ];

    // Simple homepage to list available endpoints
    app.get("/", (req, res) => {
      let html = `<h1>Available API Endpoints</h1><ul>`;
      for (const dbName of Object.keys(models)) {
        html += `<li><strong>${dbName}</strong><ul>`;
        for (const col of COLLECTION_NAMES) {
          html += `<li><a href="/api/${dbName}/${col}">/api/${dbName}/${col}</a></li>`;
        }
        html += `</ul></li>`;
      }
      html += `</ul>`;
      res.send(html);
    });

    // Dynamic collection route handler
    app.get("/api/:db/:collection", async (req, res) => {
      const { db, collection } = req.params;

      if (!models[db]) {
        return res
          .status(503)
          .json({ error: `Database "${db}" not connected yet` });
      }

      const model = models[db][collection];
      if (!model) {
        return res
          .status(404)
          .json({
            error: `Collection "${collection}" not found in DB "${db}"`,
          });
      }

      try {
        const docs = await model.find();
        res.json(docs);
      } catch (err) {
        console.error(
          chalk.red(`[${db}] Error fetching ${collection}:`),
          err.message
        );
        res.status(500).json({ error: `Failed to fetch ${collection}` });
      }
    });

    // Attach any additional API routes (modular design)
    app.use("/api", createApiRoutes(models));

    app.listen(PORT, () => {
      console.log(
        chalk.magenta(`🚀 Server running on http://localhost:${PORT}`)
      );
    });
  })
  .catch((err) => {
    console.error(chalk.red("Failed to connect to databases:"), err);
    process.exit(1); // Exit on fatal DB connection failure
  });
