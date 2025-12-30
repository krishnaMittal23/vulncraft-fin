const { OpenAI } = require("openai");
require("dotenv").config();


const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 60000, // 60 second timeout
  maxRetries: 2, // Retry failed requests twice
});

// Helper function to add timeout to promises
function withTimeout(promise, timeoutMs = 60000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}


/**
 * Generates a prompt for code security analysis.
 * @param {string} codeSnippet - The code to analyze.
 * @param {string} language - The programming language of the code (optional).
 * @returns {string} The formatted prompt.
 */
function generateCodeAnalysisPrompt(codeSnippet, language = "") {
  return `
You are a security analysis expert. Analyze the following code and provide top 10 OWASP potential security vulnerabilities in JSON format. Each vulnerability should have a severity level (HIGH, MEDIUM, LOW).


Return the response in this exact JSON structure:
{
  "vulnerabilities": [
    {
      "title": "string",
      "severity": "string",
      "description": "string",
      "impact": "string",
      "remediation": "string"
    }
  ]
}


Code to analyze:
\`\`\`${language || "text"}
${codeSnippet}
\`\`\`


Provide your response as a valid JSON object only, with no additional text or explanations.`;
}


/**
 * Analyzes a given code snippet for security vulnerabilities.
 * @param {string} codeSnippet - The code to analyze.
 * @param {string} language - The programming language of the code (optional).
 * @returns {Promise<string>} The security analysis report.
 */
async function analyzeCode(codeSnippet, language = "") {
  console.log(`\n🔍 Analyzing ${language || 'code'} snippet (${codeSnippet.length} characters)`);
  const prompt = generateCodeAnalysisPrompt(codeSnippet, language);
  console.log(`📤 Sending analysis request to LLM (prompt: ${prompt.length} chars)`);

  try {
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });
    const duration = Date.now() - startTime;

    console.log(`✅ LLM analysis completed in ${duration}ms`);
    console.log(`📥 Response structure:`, {
      hasResponse: !!response,
      hasChoices: !!response?.choices,
      choicesCount: response?.choices?.length
    });

    // Validate response structure
    if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.error("❌ Invalid API response structure:", JSON.stringify(response, null, 2));
      throw new Error('Invalid response from AI service. Please try again.');
    }

    if (!response.choices[0].message || !response.choices[0].message.content) {
      console.error("❌ Missing message content in response:", JSON.stringify(response.choices[0], null, 2));
      throw new Error('Empty response from AI service. Please try again.');
    }

    const content = response.choices[0].message.content;
    console.log(`📄 Analysis result length: ${content.length} characters`);
    console.log(`📄 Preview:\n${content.substring(0, 200)}...\n`);

    return content;
  } catch (error) {
    console.error("❌ Error in analyzeCode:", error.message);
    console.error("Full error:", error);
    throw error;
  }
}


/**
 * Detects programming language based on file extension.
 * @param {string} filePath - The file path.
 * @returns {string} - Detected language.
 */
function detectLanguage(filePath) {
  const extensionMap = {
    js: "JavaScript",
    json: "JSON",
    py: "Python",
    ts: "TypeScript",
    java: "Java",
    cpp: "C++",
    cs: "C#",
    go: "Go",
    php: "PHP",
    rb: "Ruby",
  };


  const ext = filePath.split(".").pop();
  return extensionMap[ext] || "Unknown";
}


/**
 * Generates a dynamic prompt for AI analysis.
 * @param {Array} codeFiles - List of code files (path + content).
 * @param {string} question - User's question.
 * @returns {string} - The formatted prompt.
 */
function generateAnswerCodeQueriesPrompt(codeFiles, question = "") {
  let formattedCode = codeFiles
    .map((file) => {
      const language = detectLanguage(file.path);
      return `### File: ${file.path} (${language})\n\`\`\`${language}\n${file.content}\n\`\`\`\n`;
    })
    .join("\n");


  // TODO: Improvise the prompt
  return `
You are a software analysis expert. Analyze the following codebase consisting of multiple files.


${
  question
    ? `User's question: ${question}`
    : "Provide an overview of what this code does."
}


Codebase:
${formattedCode}


IMPORTANT: Respond with ONLY a valid JSON object. Do not wrap it in markdown code blocks or add any explanation.

Respond in this exact JSON format:
{
  "summary": "Brief summary of the entire codebase",
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "potential_issues": ["Issue 1", "Issue 2"],
  "best_practices": ["Suggestion 1", "Suggestion 2"]
}
If security concerns are relevant, include them under "potential_issues". If the user asks a specific question, answer it concisely.
  `;
}


/**
 * Splits code files into chunks based on token/size limits.
 * @param {Array} codeFiles - List of code files.
 * @param {number} maxChunkSize - Maximum size per chunk in bytes (default: 80KB).
 * @returns {Array} Array of file chunks.
 */
function splitFilesIntoChunks(codeFiles, maxChunkSize = 80000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const file of codeFiles) {
    const fileSize = JSON.stringify(file).length;
    
    // If a single file is too large, truncate it
    if (fileSize > maxChunkSize) {
      const truncatedFile = {
        path: file.path,
        content: file.content.substring(0, maxChunkSize / 2) + "\n\n... [Content truncated due to size] ..."
      };
      chunks.push([truncatedFile]);
      console.warn(`File ${file.path} truncated (size: ${fileSize} bytes)`);
      continue;
    }

    // If adding this file exceeds chunk size, start a new chunk
    if (currentSize + fileSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(file);
    currentSize += fileSize;
  }

  // Add remaining files
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Generates a prompt for chunk analysis with context.
 * @param {Array} codeFiles - List of code files in this chunk.
 * @param {string} question - User's question.
 * @param {number} chunkIndex - Current chunk index.
 * @param {number} totalChunks - Total number of chunks.
 * @returns {string} - The formatted prompt.
 */
function generateChunkPrompt(codeFiles, question, chunkIndex, totalChunks) {
  let formattedCode = codeFiles
    .map((file) => {
      const language = detectLanguage(file.path);
      return `### File: ${file.path} (${language})\n\`\`\`${language}\n${file.content}\n\`\`\`\n`;
    })
    .join("\n");

  const chunkInfo = totalChunks > 1 
    ? `\n\nNote: This is chunk ${chunkIndex + 1} of ${totalChunks}. Analyze this portion and provide insights.`
    : '';

  return `
You are a software analysis expert. Analyze the following code files.${chunkInfo}

${question ? `User's question: ${question}` : "Provide insights about this code."}

Code Files:
${formattedCode}

IMPORTANT: Respond with ONLY a valid JSON object. Do not wrap it in markdown code blocks or add any explanation.

Provide a focused analysis in this exact JSON format:
{
  "files_analyzed": ["list of file paths"],
  "insights": "Key insights about these files",
  "issues": ["Any issues found"],
  "answer": "Answer to the user's question if applicable"
}
`;
}

/**
 * Extracts JSON from markdown code blocks or returns raw content.
 * @param {string} content - Content that might be wrapped in markdown.
 * @returns {string} - Cleaned JSON string.
 */
function extractJSONFromMarkdown(content) {
  // Remove markdown code blocks if present
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const match = content.match(codeBlockRegex);
  
  if (match) {
    console.log("📝 Extracted JSON from markdown code block");
    return match[1].trim();
  }
  
  return content.trim();
}

/**
 * Combines multiple chunk responses into a single coherent response.
 * @param {Array} chunkResponses - Array of responses from each chunk.
 * @param {string} question - Original user question.
 * @returns {string} - Combined response.
 */
function combineChunkResponses(chunkResponses, question) {
  const allInsights = [];
  const allIssues = [];
  const allAnswers = [];
  let allFiles = [];

  chunkResponses.forEach((response, index) => {
    try {
      // Clean the response from markdown code blocks
      const cleanedResponse = extractJSONFromMarkdown(response);
      const parsed = JSON.parse(cleanedResponse);
      
      console.log(`✅ Successfully parsed chunk ${index + 1} response`);
      
      if (parsed.files_analyzed) allFiles = allFiles.concat(parsed.files_analyzed);
      if (parsed.insights) allInsights.push(parsed.insights);
      if (parsed.issues) allIssues.push(...parsed.issues);
      if (parsed.answer) allAnswers.push(parsed.answer);
    } catch (e) {
      console.warn(`⚠️  Failed to parse chunk ${index + 1} response:`, e.message);
      console.warn(`Raw response preview: ${response.substring(0, 100)}...`);
      // Use the raw response as insight if parsing fails
      allInsights.push(response.substring(0, 500));
    }
  });

  const combinedResponse = {
    summary: `Analyzed ${allFiles.length} files across ${chunkResponses.length} chunks`,
    files_analyzed: [...new Set(allFiles)],
    key_insights: allInsights,
    potential_issues: [...new Set(allIssues)],
    answer: question ? allAnswers.join('\n\n') : undefined
  };

  return JSON.stringify(combinedResponse, null, 2);
}

/**
 * Processes a single chunk of files.
 * @param {Array} chunk - Code files in this chunk.
 * @param {string} question - User's question.
 * @param {number} chunkIndex - Current chunk index.
 * @param {number} totalChunks - Total number of chunks.
 * @returns {Promise<string>} - Analysis for this chunk.
 */
async function processChunk(chunk, question, chunkIndex, totalChunks) {
  console.log(`\n📤 Sending chunk ${chunkIndex + 1}/${totalChunks} to LLM...`);
  const prompt = generateChunkPrompt(chunk, question, chunkIndex, totalChunks);
  console.log(`Prompt length: ${prompt.length} characters`);

  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: "google/gemini-2.0-flash-exp:free",
    messages: [
      { role: "system", content: "You are a coding assistant that provides concise, structured analysis." },
      { role: "user", content: prompt },
    ],
  });
  const duration = Date.now() - startTime;

  console.log(`✅ LLM responded in ${duration}ms`);
  console.log(`📥 Raw LLM Response Structure:`, {
    hasResponse: !!response,
    hasChoices: !!response?.choices,
    choicesLength: response?.choices?.length,
    hasMessage: !!response?.choices?.[0]?.message,
    hasContent: !!response?.choices?.[0]?.message?.content,
    contentPreview: response?.choices?.[0]?.message?.content?.substring(0, 200)
  });

  // Validate response structure
  if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
    console.error(`❌ Invalid response structure for chunk ${chunkIndex + 1}:`, JSON.stringify(response, null, 2));
    throw new Error(`Invalid response for chunk ${chunkIndex + 1}`);
  }

  if (!response.choices[0].message || !response.choices[0].message.content) {
    console.error(`❌ Missing content in chunk ${chunkIndex + 1}:`, JSON.stringify(response.choices[0], null, 2));
    throw new Error(`Empty response for chunk ${chunkIndex + 1}`);
  }

  const content = response.choices[0].message.content;
  console.log(`📄 Content length: ${content.length} characters`);
  console.log(`📄 Content preview:\n${content.substring(0, 300)}...`);

  return content;
}

/**
 * Analyzes multiple code files using OpenAI API with chunking support.
 * @param {Array} codeFiles - List of code files.
 * @param {string} question - User's question.
 * @returns {Promise<string>} - The analysis report.
 */
async function getQueryAboutCode(codeFiles, question = "") {
  const totalSize = JSON.stringify(codeFiles).length;
  console.log(`Total payload size: ${totalSize} bytes (${codeFiles.length} files)`);

  // Define chunk size limit (80KB to leave room for prompt overhead)
  const MAX_CHUNK_SIZE = 80000;
  const USE_CHUNKING = totalSize > MAX_CHUNK_SIZE;

  try {
    if (!USE_CHUNKING) {
      // Small payload - process normally
      console.log("\n🔄 Processing without chunking (small payload)");
      const prompt = generateAnswerCodeQueriesPrompt(codeFiles, question);
      console.log(`📤 Sending request to LLM (prompt length: ${prompt.length} characters)`);
      
      const startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: "You are a coding assistant." },
          { role: "user", content: prompt },
        ],
      });
      const duration = Date.now() - startTime;

      console.log(`✅ LLM responded in ${duration}ms`);
      console.log(`📥 Response structure:`, {
        hasResponse: !!response,
        hasChoices: !!response?.choices,
        choicesCount: response?.choices?.length,
        hasContent: !!response?.choices?.[0]?.message?.content
      });

      if (!response?.choices?.[0]?.message?.content) {
        console.error("❌ Invalid response structure:", JSON.stringify(response, null, 2));
        throw new Error('Invalid response from AI service.');
      }

      const content = response.choices[0].message.content;
      console.log(`📄 Response length: ${content.length} characters`);
      console.log(`📄 Response preview:\n${content.substring(0, 300)}...\n`);

      return content;
    }

    // Large payload - use chunking
    console.log("\n🔄 Large payload detected - using chunking strategy");
    const chunks = splitFilesIntoChunks(codeFiles, MAX_CHUNK_SIZE);
    console.log(`📦 Split into ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      const chunkSize = JSON.stringify(chunk).length;
      console.log(`  Chunk ${i + 1}: ${chunk.length} files, ${chunkSize} bytes`);
    });

    // Process chunks sequentially to avoid rate limits
    const chunkResponses = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n🔧 Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} files)`);
      
      try {
        const chunkResponse = await processChunk(chunks[i], question, i, chunks.length);
        chunkResponses.push(chunkResponse);
        console.log(`✅ Chunk ${i + 1} processed successfully`);
        
        // Add a small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          console.log(`⏱️  Waiting 500ms before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${i + 1}:`, error.message);
        chunkResponses.push(JSON.stringify({
          error: `Failed to process chunk ${i + 1}`,
          files_analyzed: chunks[i].map(f => f.path)
        }));
      }
    }

    // Combine all chunk responses
    console.log("\n🔗 Combining all chunk responses...");
    const finalResponse = combineChunkResponses(chunkResponses, question);
    console.log("✅ Successfully combined all chunk responses");
    console.log(`📊 Final response length: ${finalResponse.length} characters\n`);
    
    return finalResponse;

  } catch (error) {
    console.error("Error in analysisService:", error);
    if (error.message && error.message.includes('413')) {
      throw new Error('Payload Too Large: The code files are too large to analyze. Please try with fewer or smaller files.');
    }
    throw error;
  }
}


module.exports = { analyzeCode, getQueryAboutCode };