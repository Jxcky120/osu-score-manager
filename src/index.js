const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require("fs");
const { fork } = require('child_process');
const { dialog, shell } = require('electron');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1270,
    height: 820,
    minWidth: 1270,
    minHeight: 820,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true, 
  });
  //mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "./dashboard/index.html"));
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
});

let osu_path = "";

async function handleSelectOsuFolder() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  let selected_path = result.filePaths[0];

  if (fs.existsSync(selected_path + "/Scores.db") && fs.existsSync(selected_path + "/Data/r") && fs.existsSync(selected_path + "/osu!.db")) {
    osu_path = result.filePaths[0];
    return osu_path;
  }
}


async function handleLoadScores(event) {
  if (!osu_path) {
    event.reply('load-scores-error', 'No osu! folder selected');
    return;
  }

  const child = fork(path.join(__dirname, 'scoreLoader.js')); 
  child.send(osu_path); 

  child.on('message', (response) => {
    if (response.status === 'success') {
      event.reply('load-scores-success', response.data);
    } else {
      event.reply('load-scores-error', response.message);
    }
  });

  child.on('error', (err) => {
    event.reply('load-scores-error', err.message);
  });
}

function decodeULEB128(buffer, start) {
  let result = 0;
  let shift = 0;
  let byte;
  let index = start;

  do {
    byte = buffer[index++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  return { value: result, newIndex: index };
}

function readString(buffer, offset) {
  let indicator = buffer[offset++];

  if (indicator == 0x0b) {
    let { value, newIndex } = decodeULEB128(buffer, offset);
    offset = newIndex;
    let string = buffer.toString("utf8", offset, offset + value);
    offset += value;
    return { string, offset };
  }
}

const sanitizeFilename = (name) => {
  return name.replace(/[<>:"/\\|?*]/g, '_'); 
};

function handleReplay(event, beatmapHash, replayHash, name = "replay.osr") {
  let replay_path = osu_path + "/Data/r/";

  // First find the files that start with beatmapHash
  let files = fs.readdirSync(replay_path).filter(file => file.startsWith(beatmapHash) && file.endsWith('.osr'));

  let replayFile = files.find(file => {
    // skip byte, integer (4 bytes), string, string
    // then read string (Has three parts; a single byte which will be either 0x00, indicating that the next two parts are not present, or 0x0b (decimal 11), indicating that the next two parts are present. If it is 0x0b, there will then be a ULEB128, representing the byte length of the following string, and then the string itself, encoded in UTF-8. See UTF-8)
    let fileData = fs.readFileSync(replay_path + file);
    let offset = 5;

    let beatmaphash_thing = readString(fileData, offset);
    offset = beatmaphash_thing.offset;

    let player_name = readString(fileData, offset);
    offset = player_name.offset;

    let replay_hash = readString(fileData, offset);
    offset = replay_hash.offset;

    return replay_hash.string === replayHash;
  });

  if (!replayFile) {
    event.reply('save-replay-error', 'Replay not found');
    return;
  }

  const result = dialog.showSaveDialogSync({
    title: 'Select the File Path to save',
    defaultPath: path.join(osu_path, '/Replays/', sanitizeFilename(name)),
    buttonLabel: 'Save',
    filters: [
      {
        name: 'Osu! Replay File',
        extensions: ['osr']
      },],
    properties: []
  })

  if (!result) {
    event.reply('save-replay-error', 'No file selected');
    return;
  }

  fs.copyFile(path + replayFile, result, (err) => {
    if (err) {
      event.reply('save-replay-error', err.message);
      return;
    }
    event.reply('save-replay-success', 'Replay saved successfully');
  });
}

function openReplay(event, beatmapHash, replayHash) {
  let replay_path = osu_path + "/Data/r/";
  // First find the files that start with beatmapHash
  let files = fs.readdirSync(replay_path).filter(file => file.startsWith(beatmapHash) && file.endsWith('.osr'));


  // Then find the file that contains the replayHash inside (it's a binary file)
  let replayFile = files.find(file => {
    // skip byte, integer (4 bytes), string, string
    // then read string (Has three parts; a single byte which will be either 0x00, indicating that the next two parts are not present, or 0x0b (decimal 11), indicating that the next two parts are present. If it is 0x0b, there will then be a ULEB128, representing the byte length of the following string, and then the string itself, encoded in UTF-8. See UTF-8)
    let fileData = fs.readFileSync(replay_path + file);
    let offset = 5;

    let beatmaphash_thing = readString(fileData, offset);
    offset = beatmaphash_thing.offset;

    let player_name = readString(fileData, offset);
    offset = player_name.offset;

    let replay_hash = readString(fileData, offset);
    offset = replay_hash.offset;

    return replay_hash.string === replayHash;
  });

  if (!replayFile) {
    event.reply('open-replay-error', 'Replay not found');
    return;
  }

  let replay = replay_path + replayFile;

  shell.openPath(replay).then(() => {
    event.reply('open-replay-success', 'Replay opened successfully');
  }
  ).catch((err) => { event.reply('open-replay-error', err.message); });
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(() => {
  ipcMain.handle('select:osufolder', handleSelectOsuFolder);
  ipcMain.on('load:scores', handleLoadScores);
  ipcMain.on('save:replay', handleReplay);
  ipcMain.on('open:replay', openReplay);
  ipcMain.on('set:osufolder', (event, path) => {
    osu_path = path
  });

  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
