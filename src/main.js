// Import the required modules and plugins
import plugin from "../plugin.json";
import LRUCache from "./cache.js";

// Import the fsOperation module and editorManager's 'editor' object
const fsOperation = acode.require("fsOperation");
const { editor } = editorManager;

// Define a class for PathIntellisense
class PathIntellisense {
  constructor() {
    // Initialize a cache for directory contents
    this.directoryCache = new LRUCache();
  }

  async init() {
    // Add a completer for the code editor
    const self = this;
    editor.completers.push({
      getCompletions: async function (editor, session, pos, prefix, callback) {
        // Get the current line and input
        const currentLine = session.getLine(pos.row);
        let input = self.getCurrentInput(currentLine, pos.column);

        // Check if an active file exists
        if (!editorManager.activeFile.uri) return;

        // Get the current directory
        let currentDirectory = self.removeFileNameAndExtension(
          editorManager.activeFile.uri
        );

        // Determine the type of input and fetch directory contents accordingly
        if (input.startsWith("/")) {
          // Handle an absolute path
          const basePath = currentDirectory;
          const fullPath = self.resolveRelativePath(basePath, input);
          await self.fetchDirectoryContents(fullPath, callback, false);
        } else if (input.startsWith("../")) {
          // Handle a relative path with parent directory reference
          const basePath = currentDirectory;
          const fullPath = self.resolveRelativePath(basePath, input);
          await self.fetchDirectoryContents(fullPath, callback, false);
        } else if (input.startsWith("./")) {
          // Handle a relative path within the same directory
          const basePath = currentDirectory;
          const fullPath = self.resolveRelativePath(
            basePath,
            input.substring(1)
          );
          await self.fetchDirectoryContents(fullPath, callback, false);
        } else {
          // Handle a normal input
          await self.fetchDirectoryContents(currentDirectory, callback, true);
        }
      }
    });

    // Add a command for auto-completing with a slash
    editor.commands.on("afterExec", function (e) {
      if (e.command.name === "insertstring" && e.args === "/") {
        editor.execCommand("startAutocomplete");
      }
    });
  }

  async fetchDirectoryContents(path, callback, isNormal) {
    try {
      // Require the 'helpers' module and check if data is cached
      const helpers = acode.require("helpers");
      const cachedData = await this.directoryCache.getAsync(path);

      if (cachedData) {
        // Use cached data if available
        callback(null, cachedData);
        return;
      }

      // Retrieve the directory contents and create suggestions
      const list = await fsOperation(path).lsDir();
      const suggestions = list.map(function (item) {
        const completion = {
          caption: item.name,
          value: item.name,
          score: isNormal ? 500 : 8000,
          meta: item.isFile ? "File" : "Folder"
        };

        if (extraSyntaxHighlightsInstalled) {
          completion.icon = item.isFile
            ? helpers.getIconForFile(item.name)
            : "icon folder";
        }

        if (!item.isFile) {
          completion.value += "/";
        }

        return completion;
      });

      // Cache the directory contents for future use
      await this.directoryCache.setAsync(path, suggestions);

      // Call the callback function with the suggestions
      callback(null, suggestions);
    } catch (err) {
      // Handle errors and log them
      callback(null, []);
      console.log(err);
    }
  }

  getCurrentInput(line, column) {
    // Extract the current input based on the cursor position
    let input = "";
    let i = column - 1;
    while (i >= 0 && /[a-zA-Z0-9/.+_\-\s]/.test(line[i])) {
      input = line[i] + input;
      i--;
    }
    return input;
  }

  resolveRelativePath(basePath, relativePath) {
    // Resolve a relative path based on the current directory
    if (relativePath.startsWith("/")) {
      // Absolute path, return it as is
      return basePath + relativePath;
    }

    // Handle a relative path with '::' separator
    const basePathParts = basePath.split("::");
    if (basePathParts.length === 2) {
      const baseUri = basePathParts[0];
      let baseDir = basePathParts[1];

      // Ensure baseDir ends with "/"
      if (!baseDir.endsWith("/")) {
        baseDir += "/";
      }

      const relativeParts = relativePath.split("/");

      for (const part of relativeParts) {
        if (part === "..") {
          // Move up one directory, but avoid going above the root
          const lastSlashIndex = baseDir.lastIndexOf("/", baseDir.length - 2);
          if (lastSlashIndex !== -1) {
            baseDir = baseDir.substring(0, lastSlashIndex + 1);
          }
        } else if (part !== "." && part !== "") {
          baseDir += part + "/";
        }
      }

      const resolvedPath = baseUri + "::" + baseDir;
      return resolvedPath;
    }

    return basePath;
  }

  removeFileNameAndExtension(filePath) {
    // Remove the file name and extension from a file path
    const lastSlashIndex = filePath.lastIndexOf("/");
    const fileName = filePath.substring(lastSlashIndex + 1);
    return filePath.substring(0, filePath.length - fileName.length - 1);
  }

  async destroy() {
    // Cleanup and destroy any resources if needed
  }
}

if (window.acode) {
  // Initialize the PathIntellisense plugin and set up its lifecycle hooks
  const acodePlugin = new PathIntellisense();
  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
      }
      acodePlugin.baseUrl = baseUrl;
      await acodePlugin.init($page, cacheFile, cacheFileUrl);
    }
  );
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
