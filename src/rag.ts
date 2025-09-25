import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { AIMessageChunk } from "@langchain/core/messages";
import "dotenv/config";

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

export const indexFile = async (filePath: string): Promise<void> => {
  console.log("Indexing file", filePath);
  console.log("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
  if (!vectorSearchCache[filePath]) {
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    const splits = await loadAndSplit(filePath);
    console.log("Indexing vectors");
    vectorSearchCache[filePath] = await MemoryVectorStore.fromDocuments(
      splits,
      embeddings
    );
  } else {
    console.log("Using cached vectors");
  }
};

export const search = async (
  query: string,
  filePath: string
): Promise<DocumentInterface[]> => {
  if (!vectorSearchCache[filePath]) {
    await indexFile(filePath);
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
    Answer the question based on codebase provided and show some examples of usage: 
    {context}
    ---
    Answer the question and help user to find solution based on codebase provided: {question}
  `);

  return prompt.format({ context, question });
};

export const generateOutput = (prompt: string): Promise<AIMessageChunk> => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  console.log("Generated output");
  return llm.invoke(prompt);
};
