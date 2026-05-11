#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const aiDir = path.join(__dirname, 'ai-service');
const isWin = process.platform === 'win32';
const venvPython = path.join(aiDir, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

let pythonExe = fs.existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3');

const child = spawn(pythonExe, ['app.py'], {
  cwd: aiDir,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.warn('[AI] Could not start:', err.message);
});
