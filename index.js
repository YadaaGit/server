// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dns from "dns";

import apiRoutes from "./routes/apiRoutes.js";

import programSchema from "./models/Program.js";
import courseSchema from "./models/Course.js";
import moduleSchema from "./models/Module.js";
import finalQuizSchema from "./models/FinalQuiz.js";
import imageSchema from "./models/Image.js";
import certificateSchema from "./models/Certificate.js";

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/templates", express.static("templates"));
app.use("/certificates", express.static("certificates"));
const PORT = process.env.PORT || 4000;

const mongooseOptions = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
};

const connections = {};
const models = {};

async function connectDbWithFallback(dbKey, dbName, schemas) {
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

  // Attach models dynamically
  models[dbKey] = {};
  for (const { name, schema, collection } of schemas) {
    models[dbKey][name] = connections[dbKey].model(name, schema, collection);
  }
}

async function setupConnections() {
  const courseSchemas = [
    { name: "Program", schema: programSchema, collection: "programs" },
    { name: "Course", schema: courseSchema, collection: "courses" },
    { name: "Module", schema: moduleSchema, collection: "modules" },
    { name: "FinalQuiz", schema: finalQuizSchema, collection: "final_quiz" },
    { name: "Image", schema: imageSchema, collection: "images" },
  ];

  const dbConfigs = [
    { key: "AM_courses", name: "AM_courses", schemas: courseSchemas },
    { key: "OR_courses", name: "OR_courses", schemas: courseSchemas },
    { key: "EN_courses", name: "EN_courses", schemas: courseSchemas },
  ];

  await Promise.all(
    dbConfigs.map(({ key, name, schemas }) =>
      connectDbWithFallback(key, name, schemas)
    )
  );

  // Certificates DB
  await connectDbWithFallback("CERTS", "Certificates", [
    { name: "Certificate", schema: certificateSchema, collection: "certificates" },
  ]);
}

// Start server
setupConnections()
  .then(() => {
    app.use("/api", apiRoutes(models));

    // Root endpoint
    app.get("/", (req, res) => {
      const langs = ["en", "am", "or"];
      const resources = ["programs", "courses", "modules", "final_quiz", "images"];

      const endpoints = langs
        .map(
          (lang) =>
            `<li>${lang.toUpperCase()}:</li>
             <ul>
               ${resources
                 .map((r) => `<li><a href="/api/${lang}/${r}">${r} (list)</a></li>`)
                 .join("")}
             </ul>`
        )
        .join("");

      res.send(`<h1>API Endpoints</h1>
                <ul>${endpoints}</ul>
                <h2>Certificates</h2>
                <ul>
                  <li><a href="/api/certificates/issues">Issue Certificate</a></li>
                </ul>`);
    });

    app.listen(PORT, () => {
      console.log(chalk.magenta(`🚀 Server running on port ${PORT}`));
    });
  })
  .catch((err) => {
    console.error(chalk.red("DB connection failed:"), err);
    process.exit(1);
  });
