import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { getCurrentTimestamp } from "./utils/loggingUtil.ts";

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/test", (req: Request, res: Response) => {
  console.log("Calling your endpoint!");

  res.status(200).json({
    message: "It works!",
  });
});

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} - 🎬 index - Authentication server listening on port: ${port}`);
});
