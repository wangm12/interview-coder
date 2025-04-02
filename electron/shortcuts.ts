import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps
  private isClickThrough = true; // Default to true for click-through mode

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
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

  private toggleClickThrough(): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;
    
    this.isClickThrough = !this.isClickThrough;
    
    if (this.isClickThrough) {
      // Enable click-through but keep window visible
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      console.log('Click-through enabled - window will ignore mouse events');
    } else {
      // Disable click-through
      mainWindow.setIgnoreMouseEvents(false);
      console.log('Click-through disabled - window will respond to mouse events');
    }
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+Shift+\\+H", async () => {
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
    })

    globalShortcut.register("CommandOrControl+Shift+\\+E", async () => {
      console.log("Command+Shift+\\+E pressed. Processing screenshots...")
      await this.deps.processingHelper?.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+R", () => {
      console.log(
        "Command+Shift+\\+R pressed. Canceling requests and resetting queues..."
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
    })

    // Window movement shortcuts
    globalShortcut.register("CommandOrControl+Shift+\\+Left", () => {
      console.log("Command+Shift+\\+Left pressed. Moving window left.")
      this.deps.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+Right", () => {
      console.log("Command+Shift+\\+Right pressed. Moving window right.")
      this.deps.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+Down", () => {
      console.log("Command+Shift+\\+Down pressed. Moving window down.")
      this.deps.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+Up", () => {
      console.log("Command+Shift+\\+Up pressed. Moving window Up.")
      this.deps.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+B", () => {
      console.log("Command+Shift+\\+B pressed. Toggling window visibility.")
      this.deps.toggleMainWindow()
    })

    // Toggle click-through mode shortcut
    globalShortcut.register("CommandOrControl+Shift+\\+C", () => {
      console.log("Command+Shift+\\+C pressed. Toggling click-through mode.")
      this.toggleClickThrough()
    })

    globalShortcut.register("CommandOrControl+Shift+\\+Q", () => {
      console.log("Command+Shift+\\+Q pressed. Quitting application.")
      app.quit()
    })

    // Adjust opacity shortcuts
    globalShortcut.register("CommandOrControl+Shift+\\+[", () => {
      console.log("Command+Shift+\\+[ pressed. Decreasing opacity.")
      this.adjustOpacity(-0.1)
    })

    globalShortcut.register("CommandOrControl+Shift+\\+]", () => {
      console.log("Command+Shift+\\+] pressed. Increasing opacity.")
      this.adjustOpacity(0.1)
    })
    
    // Zoom controls
    globalShortcut.register("CommandOrControl+Shift+\\+-", () => {
      console.log("Command+Shift+\\+- pressed. Zooming out.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
      }
    })
    
    globalShortcut.register("CommandOrControl+Shift+\\+0", () => {
      console.log("Command+Shift+\\+0 pressed. Resetting zoom.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
      }
    })
    
    globalShortcut.register("CommandOrControl+Shift+\\+=", () => {
      console.log("Command+Shift+\\+= pressed. Zooming in.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
      }
    })
    
    // Delete last screenshot shortcut
    globalShortcut.register("CommandOrControl+Shift+\\+L", () => {
      console.log("Command+Shift+\\+L pressed. Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        // Send an event to the renderer to delete the last screenshot
        mainWindow.webContents.send("delete-last-screenshot")
      }
    })
    
    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
