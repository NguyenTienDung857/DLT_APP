const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const DECRYPT_PASSWORD = '3dudtkdtjfrP@!';
const DECRYPT_DLL = 'DecryptDll.dll';
const DECRYPT_CRYPTO_DLL = 'libcrypto-3-x64.dll';
const LOG_EXTENSIONS = new Set(['.dlt', '.log', '.bin', '.txt']);
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

async function decryptEncArchive(options = {}) {
  const inputPath = path.resolve(options.inputPath || '');
  const appRoot = path.resolve(options.appRoot || process.cwd());
  const outputRoot = path.resolve(options.outputRoot || path.join(os.tmpdir(), 'bltn-analysis-log', 'decrypted-enc'));
  const dllDir = path.resolve(options.dllDir || appRoot);

  assertReadableFile(inputPath, 'Encrypted input file');
  assertReadableFile(path.join(dllDir, DECRYPT_DLL), DECRYPT_DLL);
  assertReadableFile(path.join(dllDir, DECRYPT_CRYPTO_DLL), DECRYPT_CRYPTO_DLL);

  const baseName = sanitizeName(path.basename(inputPath, path.extname(inputPath))) || 'decrypted';
  const outputDir = path.join(outputRoot, baseName);
  let decryptWorkspace;

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    decryptWorkspace = createAsciiDecryptWorkspace(inputPath);
    const stagedInputPath = path.join(decryptWorkspace, 'input.enc');
    const zipPath = path.join(decryptWorkspace, 'output.zip');
    const stagedDllDir = path.join(decryptWorkspace, 'dll');

    fs.mkdirSync(stagedDllDir, { recursive: true });
    fs.copyFileSync(inputPath, stagedInputPath);
    fs.copyFileSync(path.join(dllDir, DECRYPT_DLL), path.join(stagedDllDir, DECRYPT_DLL));
    fs.copyFileSync(path.join(dllDir, DECRYPT_CRYPTO_DLL), path.join(stagedDllDir, DECRYPT_CRYPTO_DLL));

    await runNativeDecrypt({ inputPath: stagedInputPath, zipPath, dllDir: stagedDllDir });
    extractZipArchive(zipPath, outputDir);
  } finally {
    if (decryptWorkspace) {
      fs.rmSync(decryptWorkspace, { recursive: true, force: true });
    }
  }

  const candidates = findLogCandidates(outputDir);
  return {
    inputPath,
    outputDir,
    candidates,
    files: candidates
  };
}

function createAsciiDecryptWorkspace(inputPath) {
  const tempRoot = findAsciiWritableTempRoot(inputPath);
  return fs.mkdtempSync(path.join(tempRoot, 'job-'));
}

function findAsciiWritableTempRoot(inputPath) {
  const inputDrive = path.parse(path.resolve(inputPath)).root;
  const candidates = [
    process.env.BLTN_ENC_ASCII_TEMP,
    inputDrive && path.join(inputDrive, 'BLTN_ENC_TMP'),
    process.env.PROGRAMDATA && path.join(process.env.PROGRAMDATA, 'BLTN-Analysis-Log', 'enc-tmp'),
    process.env.SystemDrive && path.join(`${process.env.SystemDrive}\\`, 'BLTN_ENC_TMP'),
    os.tmpdir()
  ].filter(Boolean);

  const checked = new Set();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (checked.has(resolved) || !isAsciiPath(resolved)) continue;
    checked.add(resolved);

    try {
      fs.mkdirSync(resolved, { recursive: true });
      const probePath = path.join(resolved, `probe-${process.pid}-${Date.now()}.tmp`);
      fs.writeFileSync(probePath, '');
      fs.rmSync(probePath, { force: true });
      return resolved;
    } catch (_error) {
      // Try the next candidate. The source drive or system temp may be read-only.
    }
  }

  throw new Error('Could not create an ASCII-only workspace for ENC decryption. Set BLTN_ENC_ASCII_TEMP to a writable ASCII path, for example C:\\BLTN_ENC_TMP.');
}

function isAsciiPath(filePath) {
  return /^[\x00-\x7F]+$/.test(path.resolve(filePath));
}

function runNativeDecrypt({ inputPath, zipPath, dllDir }) {
  const script = `
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $env:DLT_DECRYPT_DLL_DIR
$env:PATH = $env:DLT_DECRYPT_DLL_DIR + ';' + $env:PATH
$code = @"
using System.Runtime.InteropServices;
public static class EncDecryptBridge {
  [DllImport("DecryptDll.dll", CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi)]
  public static extern int decrypt_file(string inputPath, string outputPath, string password);
}
"@
Add-Type $code
$rc = [EncDecryptBridge]::decrypt_file($env:DLT_DECRYPT_INPUT, $env:DLT_DECRYPT_OUTPUT, $env:DLT_DECRYPT_PASSWORD)
Write-Output "DLT_DECRYPT_RC=$rc"
if ($rc -ne 1) { exit $rc }
`;
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const env = {
    ...process.env,
    DLT_DECRYPT_INPUT: inputPath,
    DLT_DECRYPT_OUTPUT: zipPath,
    DLT_DECRYPT_PASSWORD: DECRYPT_PASSWORD,
    DLT_DECRYPT_DLL_DIR: dllDir
  };

  return new Promise((resolve, reject) => {
    const child = childProcess.spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodedCommand
    ], {
      cwd: dllDir,
      env,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      reject(new Error(`Could not start ENC decryptor: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) {
        resolve();
        return;
      }
      fs.rmSync(zipPath, { force: true });
      const detail = cleanDecryptOutput(`${stderr}\n${stdout}`);
      const reason = code === 2
        ? 'Incorrect ENC password or corrupted encrypted file.'
        : `Native decryptor exited with code ${code}.`;
      reject(new Error(detail ? `${reason} ${detail}` : reason));
    });
  });
}

function extractZipArchive(zipPath, outputDir) {
  const archive = fs.readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(archive);
  if (eocdOffset < 0) {
    throw new Error('Decrypted ENC output is not a valid ZIP archive.');
  }

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  let extracted = 0;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (archive.readUInt32LE(offset) !== ZIP_CENTRAL_FILE_HEADER) {
      throw new Error('Invalid ZIP central directory.');
    }

    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const entryName = archive.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    offset += 46 + fileNameLength + extraLength + commentLength;

    if (flags & 0x01) {
      throw new Error(`ZIP entry is encrypted and cannot be extracted: ${entryName}`);
    }

    const outputPath = safeArchiveOutputPath(outputDir, entryName);
    if (!outputPath) continue;

    if (entryName.endsWith('/')) {
      fs.mkdirSync(outputPath, { recursive: true });
      continue;
    }

    if (archive.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error(`Invalid ZIP local header for ${entryName}.`);
    }

    const localFileNameLength = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    let content;

    if (method === 0) {
      content = Buffer.from(compressed);
    } else if (method === 8) {
      content = zlib.inflateRawSync(compressed);
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} for ${entryName}.`);
    }

    if (content.length !== uncompressedSize) {
      throw new Error(`Extracted size mismatch for ${entryName}.`);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
    extracted += 1;
  }

  if (!extracted) {
    throw new Error('Decrypted ENC archive did not contain extractable files.');
  }

  return { extracted };
}

function findLogCandidates(outputDir) {
  const result = [];
  walkDirectory(outputDir, (filePath) => {
    if (LOG_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      result.push(filePath);
    }
  });
  return result.sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

function walkDirectory(dirPath, onFile) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, onFile);
    } else if (entry.isFile()) {
      onFile(entryPath);
    }
  }
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  return -1;
}

function safeArchiveOutputPath(outputDir, entryName) {
  const cleanName = String(entryName || '').replace(/\\/g, '/');
  if (!cleanName || cleanName.startsWith('/') || /^[A-Za-z]:\//.test(cleanName)) return null;
  const parts = cleanName.split('/').filter(Boolean);
  if (parts.includes('..')) return null;

  const resolvedRoot = path.resolve(outputDir);
  const resolvedPath = path.resolve(resolvedRoot, ...parts);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
}

function assertReadableFile(filePath, label) {
  try {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`${label} was not found: ${filePath}`);
    }
    throw error;
  }
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function cleanDecryptOutput(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('KEY read from file:') && !line.startsWith('IV read from file:'))
    .join(' ')
    .slice(0, 500);
}

module.exports = {
  decryptEncArchive,
  extractZipArchive,
  findLogCandidates,
  DECRYPT_PASSWORD
};
