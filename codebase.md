# .gitignore

```
node_modules
```

# nodemon.json

```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node src/index.ts"
}

```

# package.json

```json
{
  "name": "reg_lesson",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "dev": "nodemon"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e",
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.13.0",
    "nodemon": "^3.1.9",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3"
  },
  "dependencies": {
    "@langchain/community": "^0.3.28",
    "@langchain/core": "^0.3.37",
    "@langchain/ollama": "^0.1.5",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "langchain": "^0.3.15",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1"
  }
}

```

# src/index.ts

```ts
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

```

# src/rag.ts

```ts
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { AIMessageChunk } from "@langchain/core/messages";

export const loadAndSplit = async (path: string): Promise<Document[]> => {
  const loader = new PDFLoader(path);
  const document = await loader.load();
  console.log("Loaded document");
  // Split the document into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 0,
  });
  console.log("Splitting document");
  return textSplitter.splitDocuments(document);
};

const vectorSearchCache: Record<string, MemoryVectorStore> = {};

export const search = async (
  splits: Document[],
  query: string,
  filePath: string
): Promise<DocumentInterface[]> => {
  if (!vectorSearchCache[filePath]) {
    const embeddings = new OllamaEmbeddings();
    console.log("Indexing vectors");
    vectorSearchCache[filePath] = await MemoryVectorStore.fromDocuments(
      splits,
      embeddings
    );
  } else {
    console.log("Using cached vectors");
  }

  const vectorStore = vectorSearchCache[filePath];
  return vectorStore.similaritySearch(query);
};

export const generatePrompt = (
  search: DocumentInterface[],
  question: string
): Promise<string> => {
  let context = "";
  search.forEach((result) => {
    context += result.pageContent + " ";
  });
  console.log("Generated prompt");
  const prompt = PromptTemplate.fromTemplate(`
    Answer the question based only on the following context: 
    {context}
    ---
    Answer the question based on the above context: {question}
  `);

  return prompt.format({ context, question });
};

export const generateOutput = (prompt: string): Promise<AIMessageChunk> => {
  const ollamaLlm = new ChatOllama({
    baseUrl: "http://localhost:11434/",
    model: "llama3.2",
  });
  console.log("Generated output");
  return ollamaLlm.invoke(prompt);
};

```

# tsconfig.json

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2017",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}

```

# uploads/Harry Potter Prisoner of Azkaban.pdf

This is a binary file of the type: PDF

