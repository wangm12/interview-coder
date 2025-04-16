// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { app, BrowserWindow, dialog } from "electron"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"
import Anthropic from '@anthropic-ai/sdk';

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    }
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}
export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private geminiApiKey: string | null = null
  private anthropicClient: Anthropic | null = null

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    
    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
    });
  }
  
  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      const apiKey = config.apiKeys[config.apiProvider]
      console.log("config.apiProvider", config.apiProvider)
      console.log("config.apiKeys", config.apiKeys)
      console.log("apiKey", apiKey)
      
      if (config.apiProvider === "openai") {
        if (apiKey) {
          this.openaiClient = new OpenAI({ 
            apiKey: apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2   // Retry up to 2 times
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log("OpenAI client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, OpenAI client not initialized");
        }
      } else if (config.apiProvider === "gemini"){
        // Gemini client initialization
        this.openaiClient = null;
        this.anthropicClient = null;
        if (apiKey) {
          this.geminiApiKey = apiKey;
          console.log("Gemini API key set successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, Gemini client not initialized");
        }
      } else if (config.apiProvider === "anthropic") {
        // Reset other clients
        this.openaiClient = null;
        this.geminiApiKey = null;
        if (apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: apiKey,
            timeout: 60000,
            maxRetries: 2
          });
          console.log("Anthropic client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, Anthropic client not initialized");
        }
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // First verify we have a valid AI client
    if (config.apiProvider === "openai" && !this.openaiClient) {
      this.initializeAIClient();
      
      if (!this.openaiClient) {
        console.error("OpenAI client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "gemini" && !this.geminiApiKey) {
      this.initializeAIClient();
      
      if (!this.geminiApiKey) {
        console.error("Gemini API key not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "anthropic" && !this.anthropicClient) {
      // Add check for Anthropic client
      this.initializeAIClient();
      
      if (!this.anthropicClient) {
        console.error("Anthropic client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )
        
        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }
        
        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // Step 1: Extract problem info using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      let problemInfo;
      
      if (config.apiProvider === "openai") {
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize
          
          if (!this.openaiClient) {
            return {
              success: false,
              error: "OpenAI API key not configured or invalid. Please check your settings."
            };
          }
        }

        // Use OpenAI for processing
        const messages = [
          {
            role: "system" as const, 
            content: "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        // Send to OpenAI Vision API
        const extractionResponse = await this.openaiClient.chat.completions.create({
          model: config.extractionModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        });

        // Parse the response
        try {
          const responseText = extractionResponse.choices[0].message.content;
          // Handle when OpenAI might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error parsing OpenAI response:", error);
          return {
            success: false,
            error: "Failed to parse problem information. Please try again or use clearer screenshots."
          };
        }
      } else if (config.apiProvider === "gemini")  {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${language}.`
                },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.extractionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("Empty response from Gemini API");
          }
          
          const responseText = responseData.candidates[0].content.parts[0].text;
          
          // Handle when Gemini might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error using Gemini API:", error);
          return {
            success: false,
            error: "Failed to process with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${language}.`
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data
                  }
                }))
              ]
            }
          ];

          const response = await this.anthropicClient.messages.create({
            model: config.extractionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });

          const responseText = (response.content[0] as { type: 'text', text: string }).text;
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error: any) {
          console.error("Error using Anthropic API:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }

          return {
            success: false,
            error: "Failed to process with Anthropic API. Please check your API key or try again later."
          };
        }
      }
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        });
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100
          });
          
          // The solution success event is already sent in generateSolutionsHelper
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      // Handle OpenAI API errors specifically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later."
        };
      }

      console.error("API Error Details:", error);
      return { 
        success: false, 
        error: error.message || "Failed to process screenshots. Please try again." 
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Initial setup for all API calls
      const apiProvider = config.apiProvider;
      let finalResponse = {
        code: "",
        thoughts: [] as string[],
        time_complexity: "",
        space_complexity: ""
      };

      // ================ STAGE 1: EDGE CASES ================
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing edge cases...",
          progress: 40
        });
      }

      const edgeCasePrompt = `
Analyze the following coding problem and identify potential edge cases:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

Just list 3-5 important edge cases that a solution needs to handle.
Format the output as a simple list of edge cases without explanations.
Keep each edge case to a single line and make them very concise.
`;

      let edgeCases: string[] = [];
      
      // API Call for edge cases based on provider
      if (apiProvider === "openai" && this.openaiClient) {
        const edgeCaseResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Identify critical edge cases for coding problems. List them concisely without explanations." },
            { role: "user", content: edgeCasePrompt }
          ],
          max_tokens: 1000,
          temperature: 0.2
        });
        
        const responseText = edgeCaseResponse.choices[0].message.content;
        edgeCases = this.extractBulletPoints(responseText);
      } 
      else if (apiProvider === "gemini" && this.geminiApiKey) {
        // Gemini implementation for edge cases
        const geminiMessages = [
          {
            role: "user",
            parts: [{ text: edgeCasePrompt }]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          },
          { signal }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          const responseText = responseData.candidates[0].content.parts[0].text;
          edgeCases = this.extractBulletPoints(responseText);
        }
      }
      else if (apiProvider === "anthropic" && this.anthropicClient) {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: edgeCasePrompt }]
          }
        ];

        const response = await this.anthropicClient.messages.create({
          model: config.solutionModel || "claude-3-7-sonnet-20250219",
          max_tokens: 1000,
          messages: messages,
          temperature: 0.2
        });

        const responseText = (response.content[0] as { type: 'text', text: string }).text;
        edgeCases = this.extractBulletPoints(responseText);
      }
      
      // Update thoughts with edge cases
      finalResponse.thoughts = edgeCases;

      // Send edge case results
      if (mainWindow) {
        console.log("EDGE_CASES_EXTRACTED - Sending data:", { thoughts: edgeCases });
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.EDGE_CASES_EXTRACTED,
          { thoughts: edgeCases }
        );
      }

      // ================ STAGE 2: SOLUTION THINKING ================
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Developing solution insights...",
          progress: 50
        });
      }

      const solutionThinkingPrompt = `
For the following coding problem, provide very concise insights about your approach:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

Provide exactly 3-5 key insights about how to approach this problem.
Each insight must be:
1. Presented as a bullet point
2. Maximum 1-2 sentences each
3. Clear and direct
4. Focused on a single insight or technique

IMPORTANT: Keep each bullet point extremely concise and direct.
`;

      let solutionThoughts: string[] = [];
      
      // API Call for solution thinking based on provider
      if (apiProvider === "openai" && this.openaiClient) {
        const thinkingResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Provide extremely concise insights (1-2 sentences per point max)." },
            { role: "user", content: solutionThinkingPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.2
        });
        
        const responseText = thinkingResponse.choices[0].message.content;
        solutionThoughts = this.extractBulletPoints(responseText);
      }
      else if (apiProvider === "gemini" && this.geminiApiKey) {
        // Gemini implementation for solution thinking
        const geminiMessages = [
          {
            role: "user",
            parts: [{ text: solutionThinkingPrompt }]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1500
            }
          },
          { signal }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          const responseText = responseData.candidates[0].content.parts[0].text;
          solutionThoughts = this.extractBulletPoints(responseText);
        }
      }
      else if (apiProvider === "anthropic" && this.anthropicClient) {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: solutionThinkingPrompt }]
          }
        ];

        const response = await this.anthropicClient.messages.create({
          model: config.solutionModel || "claude-3-7-sonnet-20250219",
          max_tokens: 1500,
          messages: messages,
          temperature: 0.2
        });

        const responseText = (response.content[0] as { type: 'text', text: string }).text;
        solutionThoughts = this.extractBulletPoints(responseText);
      }
      
      // Do NOT accumulate thoughts - keep them separated by section
      // finalResponse.thoughts = [...finalResponse.thoughts, ...solutionThoughts];
      
      // Log the breakdown of thoughts for debugging
      console.log("Thoughts breakdown:");
      console.log("- Edge cases:", edgeCases);
      console.log("- Solution thinking:", solutionThoughts);

      // Send solution thinking results
      if (mainWindow) {
        console.log("SOLUTION_THINKING - Sending data:", { 
          solutionThoughts: solutionThoughts 
        });
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_THINKING,
          { 
            thoughts: solutionThoughts,  // Only send solution thoughts, not accumulated
            edgeCases: edgeCases,
            solutionThoughts: solutionThoughts
          }
        );
      }

      // ================ STAGE 3: APPROACH AND PSEUDOCODE ================
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Developing solution approach...",
          progress: 65
        });
      }

      const approachPrompt = `
Develop a solution approach for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

First, provide a high-level algorithm approach (step by step).

THEN, PROVIDE A SECTION CLEARLY LABELED AS "PSEUDOCODE:" that contains a detailed pseudocode implementation of your solution. 
Format the pseudocode in a code block using triple backticks, like this:

\`\`\`
function sampleAlgorithm(input):
    // initialization steps
    initialize variables
    
    // main logic with proper indentation
    for each element in input:
        if condition:
            do something
            nested operations
        else:
            do something else
    
    // return the result
    return result
\`\`\`

IMPORTANT FORMATTING REQUIREMENTS:
1. Use proper indentation (4 spaces per level) to show nested blocks and structure
2. Include clear comments before major sections
3. Use consistent naming and syntax
4. Structure the code with clear logical blocks
5. Make sure conditionals and loops are properly indented

If your solution involves recursion, clearly explain the recursion logic, base case, and stopping condition.
If your solution involves dynamic programming, explain the DP table structure, state transitions, and base cases.
`;

      let thoughts: string[] = [];
      let pseudoCode = "";
      
      console.log("Sending approach prompt:", approachPrompt);
      
      // API Call for approach based on provider
      if (apiProvider === "openai" && this.openaiClient) {
        const approachResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Develop clear solution approaches for coding problems." },
            { role: "user", content: approachPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.2
        });
        
        const responseText = approachResponse.choices[0].message.content;
        console.log("Approach response full text:", responseText);
        thoughts = this.extractBulletPoints(responseText);
        pseudoCode = this.extractPseudoCode(responseText);
        console.log("Extracted pseudocode:", pseudoCode);
      } 
      else if (apiProvider === "gemini" && this.geminiApiKey) {
        // Gemini implementation for approach
        const geminiMessages = [
          {
            role: "user",
            parts: [{ text: approachPrompt }]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2000
            }
          },
          { signal }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          const responseText = responseData.candidates[0].content.parts[0].text;
          console.log("Gemini approach response:", responseText);
          thoughts = this.extractBulletPoints(responseText);
          pseudoCode = this.extractPseudoCode(responseText);
          console.log("Extracted pseudocode from Gemini:", pseudoCode);
        }
      }
      else if (apiProvider === "anthropic" && this.anthropicClient) {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: approachPrompt }]
          }
        ];

        const response = await this.anthropicClient.messages.create({
          model: config.solutionModel || "claude-3-7-sonnet-20250219",
          max_tokens: 2000,
          messages: messages,
          temperature: 0.2
        });

        const responseText = (response.content[0] as { type: 'text', text: string }).text;
        console.log("Anthropic approach response:", responseText);
        thoughts = this.extractBulletPoints(responseText);
        pseudoCode = this.extractPseudoCode(responseText);
        console.log("Extracted pseudocode from Anthropic:", pseudoCode);
      }
      
      // Update thoughts with approach insights
      finalResponse.thoughts = [...edgeCases, ...solutionThoughts, ...thoughts];

      // Send approach results
      if (mainWindow) {
        // Debug log to check what we're sending
        console.log("APPROACH_DEVELOPED - Sending data with pseudo_code:", { 
          thoughts: thoughts.length,
          pseudo_code: pseudoCode,
          pseudo_code_length: pseudoCode ? pseudoCode.length : 0,
          is_null: pseudoCode === null,
          is_empty: pseudoCode === "",
          typeof: typeof pseudoCode
        });
        
        console.log("APPROACH_DEVELOPED - Sending data:", { 
          thoughts: thoughts,
          pseudo_code: pseudoCode
        });
        
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.APPROACH_DEVELOPED,
          { 
            thoughts: thoughts,  // Only send approach thoughts, not accumulated
            pseudo_code: pseudoCode
          }
        );
      }

      // ================ STAGE 4: SOLUTION CODE ================
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Generating solution code...",
          progress: 80
        });
      }

      const codePrompt = `
Generate a clean, optimized solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

Based on the following approach:
${pseudoCode}

Provide only the full, runnable code solution. Make it efficient, handle edge cases, and include necessary comments for clarity.
`;

      // API Call for code based on provider
      if (apiProvider === "openai" && this.openaiClient) {
        const codeResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Generate clean, optimized code solutions." },
            { role: "user", content: codePrompt }
          ],
          max_tokens: 2000,
          temperature: 0.2
        });
        
        const responseText = codeResponse.choices[0].message.content;
        finalResponse.code = this.extractCodeBlock(responseText);
      } 
      else if (apiProvider === "gemini" && this.geminiApiKey) {
        // Gemini implementation for code
        const geminiMessages = [
          {
            role: "user",
            parts: [{ text: codePrompt }]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2000
            }
          },
          { signal }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          const responseText = responseData.candidates[0].content.parts[0].text;
          finalResponse.code = this.extractCodeBlock(responseText);
        }
      }
      else if (apiProvider === "anthropic" && this.anthropicClient) {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: codePrompt }]
          }
        ];

        const response = await this.anthropicClient.messages.create({
          model: config.solutionModel || "claude-3-7-sonnet-20250219",
          max_tokens: 2000,
          messages: messages,
          temperature: 0.2
        });

        const responseText = (response.content[0] as { type: 'text', text: string }).text;
        finalResponse.code = this.extractCodeBlock(responseText);
      }
      
      // Send code results
      if (mainWindow) {
        console.log("CODE_GENERATED - Sending data:", { 
          thoughts: finalResponse.thoughts,
          code: finalResponse.code 
        });
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.CODE_GENERATED,
          { 
            thoughts: finalResponse.thoughts,
            code: finalResponse.code 
          }
        );
      }

      // ================ STAGE 5: COMPLEXITY ANALYSIS ================
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing time and space complexity...",
          progress: 90
        });
      }

      const complexityPrompt = `
Analyze the time and space complexity of the following solution:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

SOLUTION:
${finalResponse.code}

Provide a detailed analysis of:
1. Time Complexity: What is the Big O notation? Explain why in 2-3 sentences.
2. Space Complexity: What is the Big O notation? Explain why in 2-3 sentences.

Be specific about how you arrived at your complexity analysis.
`;

      // API Call for complexity based on provider
      if (apiProvider === "openai" && this.openaiClient) {
        const complexityResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Provide detailed complexity analysis for algorithms." },
            { role: "user", content: complexityPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.2
        });
        
        const responseText = complexityResponse.choices[0].message.content;
        const complexities = this.extractComplexity(responseText);
        finalResponse.time_complexity = complexities.time;
        finalResponse.space_complexity = complexities.space;
      } 
      else if (apiProvider === "gemini" && this.geminiApiKey) {
        // Gemini implementation for complexity
        const geminiMessages = [
          {
            role: "user",
            parts: [{ text: complexityPrompt }]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          },
          { signal }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          const responseText = responseData.candidates[0].content.parts[0].text;
          const complexities = this.extractComplexity(responseText);
          finalResponse.time_complexity = complexities.time;
          finalResponse.space_complexity = complexities.space;
        }
      }
      else if (apiProvider === "anthropic" && this.anthropicClient) {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: complexityPrompt }]
          }
        ];

        const response = await this.anthropicClient.messages.create({
          model: config.solutionModel || "claude-3-7-sonnet-20250219",
          max_tokens: 1000,
          messages: messages,
          temperature: 0.2
        });

        const responseText = (response.content[0] as { type: 'text', text: string }).text;
        const complexities = this.extractComplexity(responseText);
        finalResponse.time_complexity = complexities.time;
        finalResponse.space_complexity = complexities.space;
      }

      // Final solution success
      if (mainWindow) {
        console.log("SOLUTION_SUCCESS - Sending final data:", { 
          code: finalResponse.code,
          thoughts: finalResponse.thoughts,
          time_complexity: finalResponse.time_complexity,
          space_complexity: finalResponse.space_complexity
        });
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          finalResponse
        );
      }

      return { success: true, data: finalResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      }
      
      console.error("Solution generation error:", error);
      return { success: false, error: error.message || "Failed to generate solution" };
    }
  }

  // Helper methods to extract different parts from AI responses
  private extractBulletPoints(text: string): string[] {
    // Find bullet points or numbered lists
    const bulletRegex = /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g;
    const matches = [...text.matchAll(bulletRegex)];
    
    if (matches.length > 0) {
      return matches.map(match => match[1].trim()).filter(Boolean);
    }
    
    // If no bullet points found, try to extract sentences
    const sentences = text.split(/(?:[.!?]\s+|\n)/).map(s => s.trim()).filter(Boolean);
    return sentences.slice(0, Math.min(5, sentences.length));
  }

  private extractPseudoCode(text: string): string {
    console.log("Extracting pseudocode from text:", text.substring(0, 300) + "...");
    
    // First try to extract code blocks - most reliable format
    const codeBlockRegexes = [
      // Standard code block with pseudocode or algorithm language
      /```(?:pseudocode|algorithm|plaintext)?\s*([\s\S]*?)```/i,
      
      // Any code block if the first pattern doesn't match
      /```\s*([\s\S]*?)```/i
    ];
    
    for (const regex of codeBlockRegexes) {
      const match = text.match(regex);
      if (match && match[1] && match[1].trim().length > 0) {
        const extracted = match[1].trim();
        console.log("Extracted pseudocode using code block pattern:", extracted);
        return extracted;
      }
    }
    
    // Try to find pseudocode section between markers as fallback
    const pseudoRegexes = [
      // Look for "Pseudo-code:" or "Pseudocode:" or "Algorithm:" heading
      /(?:Pseudo[ -]?[Cc]ode:?|Algorithm:?)([\s\S]*?)(?=\n\s*(?:[A-Z][a-z]+:|\d+\.|$))/i,
      
      // Look for sections between headers
      /(?:##\s*Pseudo[ -]?[Cc]ode|##\s*Algorithm)([\s\S]*?)(?=##|$)/i,
      
      // Look for numbered steps for algorithm
      /(?:Steps:|Algorithm steps:|Approach:)([\s\S]*?)(?=\n\s*(?:[A-Z][a-z]+:|\d+\.|Time|Space|$))/i
    ];
    
    // Try each regex pattern
    for (const regex of pseudoRegexes) {
      const match = text.match(regex);
      if (match && match[1] && match[1].trim().length > 0) {
        const extracted = match[1].trim();
        console.log("Extracted pseudocode using heading pattern:", extracted);
        return extracted;
      }
    }
    
    // Last resort: look for numbered steps (1., 2., etc.) as a fallback
    const stepLines = text.match(/(?:^|\n)\s*(?:\d+\.\s+)(.+)/g);
    if (stepLines && stepLines.length > 0) {
      const extracted = stepLines.join('\n').trim();
      console.log("Extracted pseudocode using numbered steps pattern:", extracted);
      return extracted;
    }
    
    console.log("No pseudocode found in text");
    return "";
  }

  private extractCodeBlock(text: string): string {
    const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```/;
    const match = text.match(codeBlockRegex);
    
    return match ? match[1].trim() : text.trim();
  }

  private extractComplexity(text: string): { time: string, space: string } {
    // Extract time complexity
    const timeRegex = /(?:Time[- ]?[Cc]omplexity:?|Time:?)\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space|$))/i;
    const timeMatch = text.match(timeRegex);
    
    // Extract space complexity
    const spaceRegex = /(?:Space[- ]?[Cc]omplexity:?|Space:?)\s*([^\n]+(?:\n[^\n]+)*?)(?=\n|$)/i;
    const spaceMatch = text.match(spaceRegex);
    
    const formatComplexity = (complexity: string | null): string => {
      if (!complexity) return "O(n) - Complexity not available";
      
      const bigORegex = /O\([^)]+\)/i;
      if (bigORegex.test(complexity)) {
        if (!complexity.includes('-') && !complexity.includes('because')) {
          const notation = complexity.match(bigORegex)?.[0] || "";
          return `${notation} - ${complexity.replace(notation, '').trim()}`;
        }
        return complexity.trim();
      }
      
      return `O(n) - ${complexity.trim()}`;
    };
    
    return {
      time: formatComplexity(timeMatch?.[1] || null),
      space: formatComplexity(spaceMatch?.[1] || null)
    };
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      let debugContent;
      
      if (config.apiProvider === "openai") {
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings."
          };
        }
        
        const messages = [
          {
            role: "system" as const, 
            content: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

Your response MUST follow this exact structure with these section headers (use ### for headers):
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed` 
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        });
        
        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

          const geminiMessages = [
            {
              role: "user",
              parts: [
                { text: debugPrompt },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Gemini...",
              progress: 60
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.debuggingModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("Empty response from Gemini API");
          }
          
          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error: "Failed to process debug request with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: debugPrompt
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const, 
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Claude...",
              progress: 60
            });
          }

          const response = await this.anthropicClient.messages.create({
            model: config.debuggingModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });
          
          debugContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error("Error using Anthropic API for debugging:", error);
          
          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }
          
          return {
            success: false,
            error: "Failed to process debug request with Anthropic API. Please check your API key or try again later."
          };
        }
      }
      
      
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;
      
      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        formattedDebugContent = debugContent
          .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
          .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
          .replace(/optimizations|performance improvements/i, '## Optimizations')
          .replace(/explanation|detailed analysis/i, '## Explanation');
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints 
        ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : ["Debug analysis based on your screenshots"];
      
      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode"
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
