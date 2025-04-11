import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../../contexts/toast";
import { ApiProvider } from "../../../electron/ConfigHelper";

// Simple dropdown implementation for keyboard modifier selection
interface DropdownOption {
  value: string;
  label: string;
}

// Simplified dropdown component
const Dropdown = ({ 
  value, 
  options, 
  onChange 
}: { 
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative">
      <div 
        className="flex items-center justify-between p-2 rounded-md bg-black/50 border-white/10 text-white cursor-pointer text-xs"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label || "Select an option"}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 p-1 rounded-md z-50 bg-black border border-white/10 text-white">
          {options.map(option => (
            <div 
              key={option.value}
              className="py-1 px-2 rounded hover:bg-white/10 cursor-pointer text-xs"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type APIProvider = "openai" | "gemini" | "anthropic";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel';
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    title: 'Problem Extraction',
    description: 'Model used to analyze screenshots and extract problem details',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      },
      {
        id: "gpt-4.5-preview-2025-02-27",
        name: "gpt-4.5-preview",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "o3-mini-2025-01-31",
        name: "o3-mini",
        description: "Best overall performance for problem extraction"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ]
  },
  {
    key: 'solutionModel',
    title: 'Solution Generation',
    description: 'Model used to generate coding solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      },
      {
        id: "gpt-4.5-preview-2025-02-27",
        name: "gpt-4.5-preview",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "o3-mini-2025-01-31",
        name: "o3-mini",
        description: "Best overall performance for problem extraction"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ]
  },
  {
    key: 'debuggingModel',
    title: 'Debugging',
    description: 'Model used to debug and improve solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      },
      {
        id: "gpt-4.5-preview-2025-02-27",
        name: "gpt-4.5-preview",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "o3-mini-2025-01-31",
        name: "o3-mini",
        description: "Best overall performance for problem extraction"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ]
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  // Store API keys for each provider separately but initialize empty
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  // Match default provider from ConfigHelper ("gemini" not "openai")
  const [apiProvider, setApiProvider] = useState<APIProvider>("gemini");
  // Match default models from ConfigHelper
  const [extractionModel, setExtractionModel] = useState("gemini-2.0-flash");
  const [solutionModel, setSolutionModel] = useState("gemini-2.0-flash");
  const [debuggingModel, setDebuggingModel] = useState("gemini-2.0-flash");
  const [keyboardModifier, setKeyboardModifier] = useState("CommandOrControl");
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Helper to get the current API key based on selected provider
  const getCurrentApiKey = () => {
    switch(apiProvider) {
      case "openai": return openaiKey;
      case "gemini": return geminiKey;
      case "anthropic": return anthropicKey;
      default: return "";
    }
  };

  // Helper to set the current API key based on selected provider
  const setCurrentApiKey = (key: string) => {
    switch(apiProvider) {
      case "openai": setOpenaiKey(key); break;
      case "gemini": setGeminiKey(key); break;
      case "anthropic": setAnthropicKey(key); break;
    }
  };

  // Define modifier options
  const keyboardModifierOptions = [
    { value: "CommandOrControl", label: "Ctrl / Cmd" },
    { value: "Control", label: "Ctrl" },
    { value: "Alt", label: "Alt" },
    { value: "Option", label: "Option (macOS)" },
    { value: "CommandOrControl+Shift", label: "Ctrl+Shift / Cmd+Shift" },
    { value: "CommandOrControl+Alt", label: "Ctrl+Alt / Cmd+Alt" }
  ];

  // Format modifier for display
  const formatModifierForDisplay = (modifier: string): string => {
    switch (modifier) {
      case "CommandOrControl": return "Ctrl / Cmd";
      case "Control": return "Ctrl";
      case "Alt": return "Alt";
      case "Option": return "Option";
      case "CommandOrControl+Shift": return "Ctrl+Shift / Cmd+Shift";
      case "CommandOrControl+Alt": return "Ctrl+Alt / Cmd+Alt";
      default: return modifier;
    }
  };

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKeys?: Record<APIProvider, string>;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
        keyboardModifier?: string;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          console.log("config", config)
          // Handle API keys
          if (config.apiKeys) {
            // New format with separate keys for each provider
            setOpenaiKey(config.apiKeys.openai || "");
            setGeminiKey(config.apiKeys.gemini || "");
            setAnthropicKey(config.apiKeys.anthropic || "");
          }
          
          setApiProvider(config.apiProvider || "gemini");
          setExtractionModel(config.extractionModel || "gemini-2.0-flash");
          setSolutionModel(config.solutionModel || "gemini-2.0-flash");
          setDebuggingModel(config.debuggingModel || "gemini-2.0-flash");
          setKeyboardModifier(config.keyboardModifier || "CommandOrControl");
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    
    // Reset models to defaults for the selected provider, matching ConfigHelper logic
    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-2.0-flash");
      setSolutionModel("gemini-2.0-flash");
      setDebuggingModel("gemini-2.0-flash");
    } else if (provider === "anthropic") {
      setExtractionModel("claude-3-7-sonnet-20250219");
      setSolutionModel("claude-3-7-sonnet-20250219");
      setDebuggingModel("claude-3-7-sonnet-20250219");
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Create an apiKeys object with all provider keys
      const apiKeys: Record<ApiProvider, string> = {
        openai: openaiKey,
        gemini: geminiKey,
        anthropic: anthropicKey
      };
      
      // Get current config to check if any API keys changed
      const currentConfig = await window.electronAPI.getConfig();
      
      // Check if any API key has changed
      const hasApiKeyChanged = 
        (currentConfig.apiKeys?.openai || "") !== openaiKey ||
        (currentConfig.apiKeys?.gemini || "") !== geminiKey ||
        (currentConfig.apiKeys?.anthropic || "") !== anthropicKey;
      
      const result = await window.electronAPI.updateConfig({
        apiKeys,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        keyboardModifier,
      });
      
      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Only force reload if any API key has changed
        if (hasApiKeyChanged) {
          showToast("Reloading", "Reloading application to apply API key changes", "success");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >        
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API keys and model preferences. You'll need your own API key(s) to use this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "anthropic"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("anthropic")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "anthropic" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
            {apiProvider === "openai" ? "OpenAI API Key" : 
             apiProvider === "gemini" ? "Gemini API Key" : 
             "Anthropic API Key"}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={getCurrentApiKey()}
              onChange={(e) => setCurrentApiKey(e.target.value)}
              placeholder={
                apiProvider === "openai" ? "sk-..." : 
                apiProvider === "gemini" ? "Enter your Gemini API key" :
                "sk-ant-..." // Claude API key
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {getCurrentApiKey() && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(getCurrentApiKey())}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API keys are stored locally and never sent to any server except the respective API providers
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://platform.openai.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://platform.openai.com/api-keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ?  (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/')} 
                    className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">Anthropic</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            
            <div className="space-y-2 mb-2">
              <label className="text-sm font-medium text-white">Keyboard Modifier</label>
              <Dropdown value={keyboardModifier} options={keyboardModifierOptions} onChange={setKeyboardModifier} />
              <p className="text-xs text-white/60">Choose the modifier key for all shortcuts</p>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+H</div>
                
                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+Enter</div>
                
                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+L</div>
                
                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+R</div>
                
                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+Q</div>
                
                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+Arrow Keys</div>
                
                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+[</div>
                
                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+]</div>
                
                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+-</div>
                
                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+0</div>
                
                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">{formatModifierForDisplay(keyboardModifier)}+=</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>
            
            {modelCategories.map((category) => {
              // Get the appropriate model list based on selected provider
              const models = 
                apiProvider === "openai" ? category.openaiModels : 
                apiProvider === "gemini" ? category.geminiModels :
                category.anthropicModels;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        debuggingModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        setDebuggingModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{m.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !getCurrentApiKey()}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
