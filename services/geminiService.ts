import { Question, Syllabus } from "../types";
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
// Use jsdelivr which is often faster/more reliable in some regions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const API_KEY = process.env.DASHSCOPE_API_KEY;
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

async function extractTextFromPDF(base64: string): Promise<string> {
  try {
    console.log("Starting PDF text extraction...");
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded for text. Pages: ${pdf.numPages}`);
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }
    return fullText;
  } catch (e) {
    console.error("PDF Extraction Error:", e);
    return "";
  }
}

async function convertPDFToImages(base64: string): Promise<string[]> {
  try {
    console.log("Starting PDF to Image conversion...");
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded for images. Pages: ${pdf.numPages}`);
    const images: string[] = [];
    
    // Limit to first 30 pages to avoid payload issues
    const maxPages = Math.min(pdf.numPages, 30);
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg'));
      }
    }
    console.log(`Converted ${images.length} pages to images.`);
    return images;
  } catch (e) {
    console.error("PDF Image Conversion Error:", e);
    return [];
  }
}

function decodeBase64(base64: string): string {
  try {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.warn("Failed to decode base64 content", e);
    return "";
  }
}

async function callDashScope(messages: any[], model: string = "qwen-plus") {
  if (!API_KEY) throw new Error("Missing DASHSCOPE_API_KEY");

  const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  };

  const body = {
    model: model,
    messages: messages,
    stream: false
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DashScope API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export type ImportResult = {
  syllabus?: Syllabus;
  questions?: Question[];
};

export const analyzeAndImportFile = async (
  files: { data: string; type: string; name: string }[],
  topicHint: string
): Promise<ImportResult | null> => {
  
  const contentParts: any[] = [];
  let hasImage = false;

  // Add context files
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      hasImage = true;
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${f.type};base64,${f.data}`
        }
      });
    } else if (f.type === 'application/pdf') {
       // Try to convert PDF to images first to capture diagrams/charts
       const pdfImages = await convertPDFToImages(f.data);
       if (pdfImages.length > 0) {
         hasImage = true;
         pdfImages.forEach((img, idx) => {
           contentParts.push({
             type: "image_url",
             image_url: { url: img }
           });
           contentParts.push({ type: "text", text: `PDF Page ${idx + 1} of ${f.name}` });
         });
       } else {
         // Fallback to text extraction if image conversion fails
         const pdfText = await extractTextFromPDF(f.data);
         if (pdfText) {
           contentParts.push({ type: "text", text: `PDF Material (${f.name}):\n${pdfText}` });
         } else {
           console.warn("Failed to extract content from PDF: " + f.name);
         }
       }
    } else {
      const text = decodeBase64(f.data);
      if (text) {
        contentParts.push({ type: "text", text: `Material (${f.name}):\n${text}` });
      }
    }
  }

  if (contentParts.length === 0) return null;

  contentParts.push({ type: "text", text: `Analyze the uploaded content related to "${topicHint}".
  Extract BOTH structured knowledge points (Syllabus) AND example questions (Questions) if they exist in the document.
  
  The document might be a "Review Outline" which contains both a summary of topics and a list of practice problems.
  Do not limit yourself to just one type. Extract everything useful.` });

  const systemPrompt = `You are a Knowledge Base Import Assistant.
      Your task is to extract structured data from the input document.
      
      Output JSON with the following optional fields:
      
      1. 'syllabusData': If the document contains course outlines, knowledge points, or topic summaries.
         - courseName, description, semester
         - modules: [{ title, keyPoints }]
      
      2. 'questionsData': If the document contains exam questions, practice problems, or exercises.
         - list of questions with text, type, options, correctAnswer, explanation, tags.
         - Map types to: SINGLE_CHOICE, MULTI_CHOICE, FILL_IN_BLANK, CODE, ESSAY, DIAGRAM.
         - Automatically determine difficulty and tags.
      
      Use Simplified Chinese for all extracted text.
      Output strictly JSON.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contentParts }
  ];

  try {
    const responseText = await callDashScope(messages, hasImage ? "qwen-vl-max" : "qwen-plus");
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    const json = JSON.parse(jsonStr);

    const result: ImportResult = {};

    if (json.syllabusData) {
        result.syllabus = {
            ...json.syllabusData,
            id: Date.now().toString(),
            addedAt: Date.now()
        } as Syllabus;
    }

    if (json.questionsData && Array.isArray(json.questionsData)) {
        result.questions = json.questionsData.map((q: any) => ({
            ...q,
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            source: files[0]?.name || 'Uploaded File'
        })) as Question[];
    }

    return (result.syllabus || result.questions) ? result : null;

  } catch (e) {
    console.error("Failed to parse analyzed file", e);
    return null;
  }
  return null;
};

export const parseSyllabus = async (rawText: string): Promise<Syllabus | null> => {
  const systemPrompt = `You are an Academic Curriculum Specialist.
      Your task is to parse raw course materials (syllabus, teaching plan, table of contents) into a structured JSON object.
      
      Extract:
      1. Course Name
      2. A brief description of the course goals.
      3. A list of Modules/Chapters, and for each module, a list of key knowledge points/topics.
      
      Output strictly JSON. Use Simplified Chinese (简体中文) for the content.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: rawText }
  ];

  try {
    const responseText = await callDashScope(messages, "qwen-plus");
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    const json = JSON.parse(jsonStr);
    return {
      ...json,
      id: Date.now().toString(),
      addedAt: Date.now()
    } as Syllabus;
  } catch (e) {
    console.error("Failed to parse syllabus", e);
    return null;
  }
};

export const parseRawQuestions = async (rawText: string, sourceName: string): Promise<Question[]> => {
  const systemPrompt = `You are an expert Data Entry Specialist for Computer Science exams. 
      Your task is to parse raw, unstructured text (which may contain multiple questions, pasted from PDFs or websites) into a structured JSON array of Question objects.
      
      The input text might be messy. You must:
      1. Identify individual questions.
      2. Determine the QuestionType (SINGLE_CHOICE, MULTI_CHOICE, FILL_IN_BLANK, CODE, ESSAY).
      3. Extract options for multiple choice questions.
      4. Infer the correct answer if provided, or solve it yourself to provide the 'correctAnswer' field.
      5. Generate a brief 'explanation' in Chinese.
      6. Auto-tag the question based on CS topics (e.g., "OS", "Trees").
      7. Set the 'source' field to "${sourceName}".
      
      Output strictly JSON with this schema:
      {
        "questions": [
          {
            "id": "string",
            "type": "SINGLE_CHOICE" | "MULTI_CHOICE" | "FILL_IN_BLANK" | "CODE" | "ESSAY" | "DIAGRAM",
            "text": "string",
            "options": ["string"],
            "correctAnswer": "string",
            "explanation": "string",
            "tags": ["string"],
            "hint": "string",
            "difficulty": "Easy" | "Medium" | "Hard",
            "source": "string"
          }
        ]
      }`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: rawText }
  ];

  try {
    const responseText = await callDashScope(messages, "qwen-plus");
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    const json = JSON.parse(jsonStr);
    // Ensure IDs are unique on client side if model generates generic ones
    return json.questions.map((q: any) => ({...q, id: Date.now() + Math.random().toString(36).substr(2, 9) })) || [];
  } catch (e) {
    console.error("Failed to parse imported questions", e);
    return [];
  }
};

export const generateQuiz = async (
  files: { data: string; type: string; name: string }[],
  topic: string,
  difficulty: string,
  count: number
): Promise<Question[]> => {
  const messages: any[] = [];
  let hasImages = false;

  const systemPrompt = `You are a Computer Science professor designing an exam.
            Generate a quiz with ${count} questions about "${topic}" in Simplified Chinese (简体中文).
            Difficulty: ${difficulty}.
            
            Include a mix of:
            - Single Choice (SINGLE_CHOICE)
            - Multiple Choice (MULTI_CHOICE)
            - Fill in the blank (FILL_IN_BLANK)
            - Coding challenges (CODE)
            - Essay/Calculation/Logic (ESSAY)
            - Diagram/Visual Analysis (DIAGRAM)

            IMPORTANT: The content of the questions, options, explanation, and hint MUST be in Simplified Chinese.
            The JSON keys (id, type, text, etc.) and Enum values (SINGLE_CHOICE, etc.) MUST remain in English.

            For 'correctAnswer':
            - Single Choice: The string of the correct option.
            - Multi Choice: A JSON stringified array of correct option strings.
            - Code/Essay: A brief summary of key points expected (in Chinese).
            - Diagram: A description of what the drawing should contain (in Chinese).

            For 'codeSnippet':
            - ONLY include code that is part of the QUESTION context (e.g., "What does this code print?").
            - NEVER include the solution code or the code the student is supposed to write.
            - If the question asks the student to write code, leave this field empty or null.
            
            Output strictly JSON with this schema:
            {
              "questions": [
                {
                  "id": "string",
                  "type": "SINGLE_CHOICE" | "MULTI_CHOICE" | "FILL_IN_BLANK" | "CODE" | "ESSAY" | "DIAGRAM",
                  "text": "string",
                  "options": ["string"],
                  "correctAnswer": "string",
                  "explanation": "string",
                  "tags": ["string"],
                  "hint": "string",
                  "codeSnippet": "string"
                }
              ]
            }`;

  messages.push({ role: 'system', content: systemPrompt });

  const userContent: any[] = [];

  // Add context files
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      hasImages = true;
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${f.type};base64,${f.data}`
        }
      });
    } else if (f.type === 'application/pdf') {
      const pdfText = await extractTextFromPDF(f.data);
      if (pdfText) {
        userContent.push({ type: "text", text: `PDF Context (${f.name}):\n${pdfText}` });
      }
    } else {
      const text = decodeBase64(f.data);
      if (text) {
        userContent.push({ type: "text", text: `Context Material (${f.type}):\n${text}` });
      }
    }
  }
  
  userContent.push({ type: "text", text: `Topic: ${topic}. Difficulty: ${difficulty}. Generate ${count} questions.` });
  
  messages.push({ role: 'user', content: userContent });

  const model = hasImages ? "qwen-vl-max" : "qwen-plus";

  try {
    const responseText = await callDashScope(messages, model);
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    const json = JSON.parse(jsonStr);
    return json.questions || [];
  } catch (e) {
    console.error("Failed to parse quiz response", e);
    return [];
  }
};

export interface GradingResult {
  score: number;
  feedback: string;
  isCorrect: boolean;
}

export const gradeAnswer = async (question: Question, answer: any): Promise<GradingResult> => {
  let imageBase64: string | null = null;

  if (question.type === 'DIAGRAM' && answer instanceof File) {
    try {
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(answer);
      });
    } catch (e) {
      console.error("Error reading image file", e);
    }
  }

  const userContent: any[] = [];
  userContent.push({ type: "text", text: `Question (${question.type}): ${question.text}\nStandard Answer: ${question.correctAnswer}\nExplanation: ${question.explanation}` });

  if (imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${imageBase64}` // Assume PNG/JPEG mostly
      }
    });
    userContent.push({ type: "text", text: "Student submitted the attached diagram." });
  } else {
    userContent.push({ type: "text", text: `Student Answer: ${JSON.stringify(answer)}` });
  }

  const systemPrompt = `You are an expert TA grading a student's submission.
            Evaluate the answer based on the standard answer.
            Provide all feedback in Simplified Chinese (简体中文).
            
            For coding, check logic, bugs, and style.
            For diagrams, check if the key components exist.
            For essays, check for missing logic points.
            
            Output strictly JSON with this schema:
            {
              "score": number,
              "isCorrect": boolean,
              "feedback": "string"
            }`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  const model = imageBase64 ? "qwen-vl-max" : "qwen-plus";

  try {
    const responseText = await callDashScope(messages, model);
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    return JSON.parse(jsonStr) as GradingResult;
  } catch (e) {
    console.error("Failed to parse grading response", e);
    return { score: 0, isCorrect: false, feedback: "Error grading submission." };
  }
};

export const generateStudyPlan = async (weakPoints: string[], recentScores: number[]): Promise<string> => {
  const systemPrompt = `Create a personalized study plan in Simplified Chinese (简体中文).
        The student is weak in: ${weakPoints.join(', ')}.
        Recent quiz scores: ${recentScores.join(', ')}.

        Format the output as a Markdown list with:
        1. 现状分析 (Analysis of current status)
        2. 每日目标 (Daily Goal)
        3. 3个核心复习概念 (3 Key Concepts to review)
        4. 建议的实践练习 (A suggested practical exercise).`;

  const messages = [
    { role: 'user', content: systemPrompt }
  ];

  try {
    const responseText = await callDashScope(messages, "qwen-plus");
    return responseText || "Could not generate plan.";
  } catch (e) {
    console.error("Failed to generate study plan", e);
    return "Could not generate plan.";
  }
};

export const generateQuizFromKnowledgeBase = async (
  topic: string,
  difficulty: string,
  count: number,
  examples: Question[],
  syllabuses: Syllabus[]
): Promise<Question[]> => {
  let contextText = "";
  
  if (syllabuses.length > 0) {
      contextText += "Relevant Syllabus Content:\n";
      syllabuses.forEach((s, i) => {
          contextText += `Course: ${s.courseName}\n`;
          s.modules.forEach(m => {
              contextText += `- Module: ${m.title}\n  Key Points: ${m.keyPoints.join(', ')}\n`;
          });
          contextText += "\n";
      });
      contextText += "---\n";
  }

  if (examples.length > 0) {
      contextText += "Relevant Example Questions:\n";
      examples.forEach((q, i) => {
        contextText += `Example ${i+1} (${q.type}): ${q.text}\nAnswer: ${q.correctAnswer}\n`;
      });
      contextText += "---\n";
  }

  const systemPrompt = `You are a Computer Science professor designing an exam.
            Generate a quiz with ${count} questions about "${topic}" in Simplified Chinese (简体中文).
            Difficulty: ${difficulty}.
            
            STRICT CONSTRAINT: You must ONLY generate questions based on the provided Knowledge Base content (Syllabus and Examples). 
            Do NOT include topics, concepts, or definitions that are not present in the provided context.
            If the context does not cover the requested topic sufficiently, generate questions only on what IS covered.

            Include a mix of:
            - Single Choice (SINGLE_CHOICE)
            - Multiple Choice (MULTI_CHOICE)
            - Fill in the blank (FILL_IN_BLANK)
            - Coding challenges (CODE)
            - Essay/Calculation/Logic (ESSAY)
            - Diagram/Visual Analysis (DIAGRAM)

            IMPORTANT: The content of the questions, options, explanation, and hint MUST be in Simplified Chinese.
            The JSON keys (id, type, text, etc.) and Enum values (SINGLE_CHOICE, etc.) MUST remain in English.

            For 'correctAnswer':
            - Single Choice: The string of the correct option.
            - Multi Choice: A JSON stringified array of correct option strings.
            - Code/Essay: A brief summary of key points expected (in Chinese).
            - Diagram: A description of what the drawing should contain (in Chinese).

            For 'codeSnippet':
            - ONLY include code that is part of the QUESTION context (e.g., "What does this code print?").
            - NEVER include the solution code or the code the student is supposed to write.
            - If the question asks the student to write code, leave this field empty or null.
            
            Output strictly JSON with this schema:
            {
              "questions": [
                {
                  "id": "string",
                  "type": "SINGLE_CHOICE" | "MULTI_CHOICE" | "FILL_IN_BLANK" | "CODE" | "ESSAY" | "DIAGRAM",
                  "text": "string",
                  "options": ["string"],
                  "correctAnswer": "string",
                  "explanation": "string",
                  "tags": ["string"],
                  "hint": "string",
                  "codeSnippet": "string"
                }
              ]
            }`;

  const userMessage = `Topic: ${topic}. Difficulty: ${difficulty}. Generate ${count} questions.
  
  Use the following Knowledge Base context to guide your question generation.
  
  ${contextText}
  
  Instructions:
  1. If Syllabus Content is provided, ensure the questions cover the key points mentioned.
  2. If Example Questions are provided, use them as a reference for style, depth, and format, but generate NEW questions.
  3. If no specific context is provided, generate standard questions for the topic.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  try {
    const responseText = await callDashScope(messages, "qwen-plus");
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "");
    const json = JSON.parse(jsonStr);
    return json.questions || [];
  } catch (e) {
    console.error("Failed to parse quiz response", e);
    return [];
  }
};