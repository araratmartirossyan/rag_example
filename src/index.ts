import express, { json, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import * as fs from "fs";
import { generateOutput, generatePrompt, loadAndSplit, search } from "./rag";

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

interface Input extends Request {
  file: Express.Multer.File;
  body: {
    question: string;
  };
}

app.post(
  "/upload",
  upload.single("file"),
  async ({ file, body: { question } }: Input, res: Response) => {
    try {
      if (!file) {
        res.status(400).send("No file uploaded");
        return;
      }
      const filePath = `./uploads/${file.filename}`;
      let splits;
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      } else {
        console.log(filePath);
        // function for split file into chunks
        splits = await loadAndSplit(filePath);
        // upload file to vector database
      }

      // search
      const searches = await search(splits, question, filePath);
      // prompt
      const prompt = await generatePrompt(searches, question);
      // result
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
