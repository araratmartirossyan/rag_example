import express, { json, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import * as fs from "fs";
import { generateOutput, generatePrompt, indexFile, search } from "./rag";
import "dotenv/config";

const app = express();
app.use(json());
app.use(cors());

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (_, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

interface UploadInput extends Request {
  file: Express.Multer.File;
}

interface AskInput extends Request {
  body: {
    filename: string;
    question: string;
  };
}

app.post(
  "/upload",
  upload.single("file"),
  async ({ file }: UploadInput, res: Response) => {
    try {
      if (!file) {
        res.status(400).send("No file uploaded");
        return;
      }
      const filePath = `./uploads/${file.filename}`;
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }

      await indexFile(filePath);

      res.status(200).send({
        message: "File uploaded and indexed",
        filename: file.filename,
      });
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
);

app.post(
  "/ask",
  async ({ body: { filename, question } }: AskInput, res: Response) => {
    try {
      if (!filename || !question) {
        res.status(400).send("'filename' and 'question' are required");
        return;
      }
      const filePath = `./uploads/${filename}`;
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found. Please upload the file first.");
        return;
      }

      const searches = await search(question, filePath);
      const prompt = await generatePrompt(searches, question);
      const answer = await generateOutput(prompt);

      res.status(200).send({ message: answer.content });
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});
