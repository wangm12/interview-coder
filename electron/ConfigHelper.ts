// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"

export type ApiProvider = "openai" | "gemini" | "anthropic";

interface Config {
  apiKeys: Record<ApiProvider, string>; // Map of provider to API key
  apiProvider: ApiProvider;  // Currently selected provider
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;
  keyboardModifier: string; // For keyboard shortcut configuration
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKeys: {
      openai: "",
      gemini: "",
      anthropic: ""
    },
    apiProvider: "gemini", // Default to Gemini
    extractionModel: "gemini-2.0-flash", 
    solutionModel: "gemini-2.0-flash",
    debuggingModel: "gemini-2.0-flash",
    language: "python",
    opacity: 1.0,
    keyboardModifier: "CommandOrControl"
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: ApiProvider): string {
    if (provider === "openai") {
      // Only allow gpt-4o and gpt-4o-mini for OpenAI
      const allowedModels = ['gpt-4o', 'gpt-4o-mini'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid OpenAI model specified: ${model}. Using default model: gpt-4o`);
        return 'gpt-4o';
      }
      return model;
    } else if (provider === "gemini")  {
      // Only allow gemini-1.5-pro and gemini-2.0-flash for Gemini
      const allowedModels = ['gemini-1.5-pro', 'gemini-2.0-flash'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Gemini model specified: ${model}. Using default model: gemini-2.0-flash`);
        return 'gemini-2.0-flash'; // Changed default to flash
      }
      return model;
    }  else if (provider === "anthropic") {
      // Only allow Claude models
      const allowedModels = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Anthropic model specified: ${model}. Using default model: claude-3-7-sonnet-20250219`);
        return 'claude-3-7-sonnet-20250219';
      }
      return model;
    }
    // Default fallback
    return model;
  }

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        let config = JSON.parse(configData);
        
        // Handle migration from old config format (single apiKey) to new format (apiKeys map)
        if (config.apiKey !== undefined && (!config.apiKeys || !config.apiKeys[config.apiProvider])) {
          // Initialize apiKeys if not present
          if (!config.apiKeys) {
            config.apiKeys = {
              openai: "",
              gemini: "",
              anthropic: ""
            };
          }
          
          // Transfer the existing apiKey to the appropriate provider
          if (config.apiProvider && config.apiKey) {
            config.apiKeys[config.apiProvider] = config.apiKey;
          }
          
          // Remove the old apiKey field
          delete config.apiKey;
          
          // Save the migrated config
          this.saveConfig(config);
          console.log("Migrated config from old format (single apiKey) to new format (apiKeys map)");
        }
        
        // Ensure apiProvider is a valid value
        if (config.apiProvider !== "openai" && config.apiProvider !== "gemini" && config.apiProvider !== "anthropic") {
          config.apiProvider = "gemini"; // Default to Gemini if invalid
        }
        
        // Ensure apiKeys is properly initialized
        if (!config.apiKeys) {
          config.apiKeys = {
            openai: "",
            gemini: "",
            anthropic: ""
          };
        }
        
        // Sanitize model selections to ensure only allowed models are used
        if (config.extractionModel) {
          config.extractionModel = this.sanitizeModelSelection(config.extractionModel, config.apiProvider);
        }
        if (config.solutionModel) {
          config.solutionModel = this.sanitizeModelSelection(config.solutionModel, config.apiProvider);
        }
        if (config.debuggingModel) {
          config.debuggingModel = this.sanitizeModelSelection(config.debuggingModel, config.apiProvider);
        }
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config> & { apiKey?: string }): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider = updates.apiProvider || currentConfig.apiProvider;
      
      // Handle the case where an apiKey is provided directly (for backward compatibility)
      if (updates.apiKey !== undefined) {
        // Initialize apiKeys if not set
        const apiKeys = currentConfig.apiKeys || {
          openai: "",
          gemini: "",
          anthropic: ""
        };
        
        // Auto-detect provider based on API key format if no provider specified
        if (!updates.apiProvider) {
          if (updates.apiKey.trim().startsWith('sk-')) {
            if (updates.apiKey.trim().startsWith('sk-ant-')) {
              provider = "anthropic";
              console.log("Auto-detected Anthropic API key format");
            } else {
              provider = "openai";
              console.log("Auto-detected OpenAI API key format");
            }
          } else {
            provider = "gemini";
            console.log("Using Gemini API key format (default)");
          }
          
          // Update the provider in the updates
          updates.apiProvider = provider;
        }
        
        // Set the API key for the specific provider
        apiKeys[provider] = updates.apiKey;
        
        // Update the apiKeys in the updates
        updates.apiKeys = apiKeys;
        
        // Remove the old apiKey field
        delete updates.apiKey;
      }
      
      // If provider is changing, reset models to the default for that provider
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        if (updates.apiProvider === "openai") {
          updates.extractionModel = "gpt-4o";
          updates.solutionModel = "gpt-4o";
          updates.debuggingModel = "gpt-4o";
        } else if (updates.apiProvider === "anthropic") {
          updates.extractionModel = "claude-3-7-sonnet-20250219";
          updates.solutionModel = "claude-3-7-sonnet-20250219";
          updates.debuggingModel = "claude-3-7-sonnet-20250219";
        } else {
          updates.extractionModel = "gemini-2.0-flash";
          updates.solutionModel = "gemini-2.0-flash";
          updates.debuggingModel = "gemini-2.0-flash";
        }
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = this.sanitizeModelSelection(updates.extractionModel, provider);
      }
      if (updates.solutionModel) {
        updates.solutionModel = this.sanitizeModelSelection(updates.solutionModel, provider);
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = this.sanitizeModelSelection(updates.debuggingModel, provider);
      }
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.apiKeys !== undefined || updates.apiProvider !== undefined || 
          updates.extractionModel !== undefined || updates.solutionModel !== undefined || 
          updates.debuggingModel !== undefined || updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Get the current API key for the selected provider
   */
  public getCurrentApiKey(): string {
    const config = this.loadConfig();
    return config.apiKeys[config.apiProvider] || "";
  }

  /**
   * Get API key for a specific provider
   */
  public getApiKeyForProvider(provider: ApiProvider): string {
    const config = this.loadConfig();
    return config.apiKeys[provider] || "";
  }

  /**
   * Check if the current API provider has an API key configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.apiKeys[config.apiProvider] && config.apiKeys[config.apiProvider].trim().length > 0;
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: ApiProvider): boolean {
    // If provider is not specified, attempt to auto-detect
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
        } else {
          provider = "openai";
        }
      } else {
        provider = "gemini";
      }
    }
    
    if (provider === "openai") {
      // Basic format validation for OpenAI API keys
      return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "gemini") {
      // Basic format validation for Gemini API keys (usually alphanumeric with no specific prefix)
      return apiKey.trim().length >= 10; // Assuming Gemini keys are at least 10 chars
    } else if (provider === "anthropic") {
      // Basic format validation for Anthropic API keys
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    }
    
    return false;
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: ApiProvider): Promise<{valid: boolean, error?: string}> {
    // Auto-detect provider based on key format if not specified
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format for testing");
        } else {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format for testing");
        }
      } else {
        provider = "gemini";
        console.log("Using Gemini API key format for testing (default)");
      }
    }
    
    if (provider === "openai") {
      return this.testOpenAIKey(apiKey);
    } else if (provider === "gemini") {
      return this.testGeminiKey(apiKey);
    } else if (provider === "anthropic") {
      return this.testAnthropicKey(apiKey);
    }
    
    return { valid: false, error: "Unknown API provider" };
  }
  
  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: unknown) {
      console.error('OpenAI API key test failed:', error);
      
      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';
      
      const err = error as { status?: number; message?: string };
      
      if (err.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (err.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (err.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Test Gemini API key
   * Note: This is a simplified implementation since we don't have the actual Gemini client
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Gemini API and validate the key
      if (apiKey && apiKey.trim().length >= 20) {
        // Here you would actually validate the key with a Gemini API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: unknown) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      const err = error as { message?: string };
      
      if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Anthropic API key
   * Note: This is a simplified implementation since we don't have the actual Anthropic client
   */
  private async testAnthropicKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Anthropic API and validate the key
      if (apiKey && /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim())) {
        // Here you would actually validate the key with an Anthropic API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Anthropic API key format.' };
    } catch (error: unknown) {
      console.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';
      
      const err = error as { message?: string };
      
      if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Get the configured keyboard modifier
   */
  public getKeyboardModifier(): string {
    const config = this.loadConfig();
    return config.keyboardModifier || this.defaultConfig.keyboardModifier;
  }

  /**
   * Set the keyboard modifier for shortcuts
   */
  public setKeyboardModifier(modifier: string): void {
    this.updateConfig({ keyboardModifier: modifier });
    this.emit('keyboard-modifier-updated', modifier);
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
