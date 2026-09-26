// Electron entry point for the desktop builds (see .github/workflows/build-releases.yml).
// The web build in ./dist is served over a custom app:// scheme instead of file://,
// because pages loaded from file:// can't fetch() the app's data/*.json files.
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const DIST_DIR = path.join(__dirname, 'dist');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('app://bundle/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)));
    // Don't serve anything outside the web build
    if (!filePath.startsWith(DIST_DIR + path.sep)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
