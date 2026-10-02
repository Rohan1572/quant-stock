import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");

// Allowlist rather than a blanket `cors()`: an unscoped policy lets any site
// read scoring responses from a user's browser. Configure with CORS_ORIGINS
// (comma-separated); the default covers local development only.
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const allowedOrigins = new Set(
  (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(DEFAULT_ORIGINS),
);

app.use(
  cors({
    origin(origin, callback) {
      // `false` omits the CORS headers rather than erroring, so the browser
      // blocks the read and the request keeps its normal status.
      callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
