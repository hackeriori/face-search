import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import { initDatabase, getDatabase } from './database'
import { registerIpcHandlers, setMpvPlayer } from './ipc'
import { MpvPlayer } from './mpv'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'icon.ico')
    : path.join(__dirname, '../../resources/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1024,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  const mpvPlayer = new MpvPlayer(mainWindow)
  setMpvPlayer(mpvPlayer)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  const dbPath = path.join(path.dirname(app.getPath('exe')), 'face-search.db')
  initDatabase(dbPath)
  registerIpcHandlers(ipcMain)
  createWindow()
})

app.on('window-all-closed', () => {
  const db = getDatabase()
  if (db) db.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
