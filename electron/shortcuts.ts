import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"

// Define shortcut actions for better type safety
type ShortcutAction = 
  | "takeScreenshot" 
  | "processScreenshots" 
  | "resetQueues" 
  | "moveWindowLeft" 
  | "moveWindowRight" 
  | "moveWindowDown" 
  | "moveWindowUp" 
  | "toggleWindow" 
  | "quitApp" 
  | "decreaseOpacity" 
  | "increaseOpacity" 
  | "zoomOut" 
  | "resetZoom" 
  | "zoomIn" 
  | "deleteLastScreenshot"
  | "toggleClickThrough";

// Map action to key (the unchangeable part of the shortcut)
const SHORTCUT_KEYS: Record<ShortcutAction, string> = {
  takeScreenshot: "H",
  processScreenshots: "Enter",
  resetQueues: "R",
  moveWindowLeft: "Left",
  moveWindowRight: "Right",
  moveWindowDown: "Down",
  moveWindowUp: "Up",
  toggleWindow: "B",
  quitApp: "Q",
  decreaseOpacity: "[",
  increaseOpacity: "]",
  zoomOut: "-",
  resetZoom: "0",
  zoomIn: "=",
  deleteLastScreenshot: "L",
  toggleClickThrough: "T"
};

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps
  private registeredShortcuts: string[] = []

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
    
    // Listen for keyboard modifier updates
    configHelper.on('keyboard-modifier-updated', (modifier) => {
      console.log(`⌨️ Keyboard modifier updated to: ${modifier}`);
      this.unregisterAllShortcuts();
      this.registerGlobalShortcuts();
    });
  }

  private unregisterAllShortcuts(): void {
    // Log the number of shortcuts we're trying to unregister
    console.log(`Unregistering ${this.registeredShortcuts.length} shortcuts...`);
    
    // Unregister all previously registered shortcuts
    let unregisteredCount = 0;
    this.registeredShortcuts.forEach(shortcut => {
      try {
        globalShortcut.unregister(shortcut);
        unregisteredCount++;
        console.log(`Unregistered shortcut: ${shortcut}`);
      } catch (error) {
        console.error(`Error unregistering shortcut ${shortcut}:`, error);
      }
    });
    
    console.log(`Unregistered ${unregisteredCount}/${this.registeredShortcuts.length} shortcuts`);
    
    // As a safety measure, unregister all shortcuts
    globalShortcut.unregisterAll();
    
    // Clear the registered shortcuts array
    this.registeredShortcuts = [];
  }

  private getShortcutString(action: ShortcutAction): string {
    const modifier = configHelper.getKeyboardModifier();
    const key = SHORTCUT_KEYS[action];
    return `${modifier}+${key}`;
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;
    
    let currentOpacity = mainWindow.getOpacity();
    let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    console.log(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);
    
    mainWindow.setOpacity(newOpacity);
    
    // Save the opacity setting to config without re-initializing the client
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      console.error('Error saving opacity to config:', error);
    }
    
    // If we're making the window visible, also make sure it's shown and interaction is enabled
    if (newOpacity > 0.1 && !this.deps.isVisible()) {
      this.deps.toggleMainWindow();
    }
  }

  private registerShortcut(action: ShortcutAction, callback: () => void): void {
    const shortcutString = this.getShortcutString(action);
    
    try {
      // Check if shortcut is already registered
      if (globalShortcut.isRegistered(shortcutString)) {
        console.warn(`Shortcut ${shortcutString} is already registered. Unregistering first.`);
        globalShortcut.unregister(shortcutString);
      }
      
      const success = globalShortcut.register(shortcutString, callback);
      if (success) {
        console.log(`✅ Registered shortcut: ${shortcutString} for ${action}`);
        this.registeredShortcuts.push(shortcutString);
      } else {
        console.error(`❌ Failed to register shortcut: ${shortcutString} for ${action}`);
      }
    } catch (error) {
      console.error(`💥 Error registering shortcut ${shortcutString}:`, error);
    }
  }

  public registerGlobalShortcuts(): void {
    const keyboardModifier = configHelper.getKeyboardModifier();
    console.log(`🔄 Registering global shortcuts with modifier: ${keyboardModifier}`);
    
    // Register each shortcut with its corresponding action
    this.registerShortcut("takeScreenshot", async () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        console.log("Taking screenshot...")
        try {
          const screenshotPath = await this.deps.takeScreenshot()
          const preview = await this.deps.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    });

    this.registerShortcut("processScreenshots", async () => {
      await this.deps.processingHelper?.processScreenshots()
    });

    this.registerShortcut("resetQueues", () => {
      console.log(
        "Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests()

      // Clear both screenshot queues
      this.deps.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.deps.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    });

    // Shortcuts for moving the window
    this.registerShortcut("moveWindowLeft", () => {
      console.log("Moving window left.")
      this.deps.moveWindowLeft()
    });

    this.registerShortcut("moveWindowRight", () => {
      console.log("Moving window right.")
      this.deps.moveWindowRight()
    });

    this.registerShortcut("moveWindowDown", () => {
      console.log("Moving window down.")
      this.deps.moveWindowDown()
    });

    this.registerShortcut("moveWindowUp", () => {
      console.log("Moving window up.")
      this.deps.moveWindowUp()
    });

    this.registerShortcut("toggleWindow", () => {
      console.log("Toggling window visibility.")
      this.deps.toggleMainWindow()
    });

    this.registerShortcut("quitApp", () => {
      console.log("Quitting application.")
      app.quit()
    });

    // Adjust opacity shortcuts
    this.registerShortcut("decreaseOpacity", () => {
      console.log("Decreasing opacity.")
      this.adjustOpacity(-0.1)
    });

    this.registerShortcut("increaseOpacity", () => {
      console.log("Increasing opacity.")
      this.adjustOpacity(0.1)
    });
    
    // Zoom controls
    this.registerShortcut("zoomOut", () => {
      console.log("Zooming out.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
      }
    });
    
    this.registerShortcut("resetZoom", () => {
      console.log("Resetting zoom.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
      }
    });
    
    this.registerShortcut("zoomIn", () => {
      console.log("Zooming in.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
      }
    });
    
    this.registerShortcut("deleteLastScreenshot", () => {
      console.log("Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send("delete-last-screenshot")
      }
    });
    
    // Toggle click-through mode
    this.registerShortcut("toggleClickThrough", () => {
      console.log("Toggling click-through mode.")
      this.deps.toggleClickThrough()
    });
    
    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      this.unregisterAllShortcuts();
    });
  }
}
