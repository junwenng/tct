const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const RESTART_DELAY = 2000;

const binaryName = "proxy";
const programPath = path.join(__dirname, binaryName);

const DOWNLOAD_URL =
  "https://github.com/i-tct/tct/releases/download/v0.4.1/proxy";

function downloadBinary(url = DOWNLOAD_URL) {
  return new Promise((resolve, reject) => {

    if (fs.existsSync(programPath)) {
      const stats = fs.statSync(programPath);

      if (stats.size > 100000) {
        console.log("✅ Binary already exists, skipping download.");
        return resolve();
      }

      console.log("⚠️ Binary corrupted. Re-downloading...");
      fs.unlinkSync(programPath);
    }

    console.log("⬇️ Downloading proxy binary...");

    https.get(url, (res) => {

      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBinary(res.headers.location)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }

      const file = fs.createWriteStream(programPath);
      res.pipe(file);

      file.on("finish", () => {
        file.close(() => {

          try {
            if (process.platform !== "win32") {
              fs.chmodSync(programPath, 0o755);
            }
          } catch {}

          console.log("✅ Proxy downloaded and ready.");
          resolve();
        });
      });

      file.on("error", (err) => {
        fs.unlink(programPath, () => reject(err));
      });

    }).on("error", reject);

  });
}

let child = null;

function start() {

  try {
    if (process.platform !== "win32") {
      fs.chmodSync(programPath, 0o755);
    }
  } catch {}

  console.log("🚀 Starting proxy...");

  child = spawn(programPath, [], {
    stdio: "inherit"
  });

  child.on("close", (code) => {
    console.log(`❌ Process exited with code ${code}`);
    restart();
  });

  child.on("error", (err) => {
    console.error("❌ Failed to start:", err);
    restart();
  });
}

function restart() {
  console.log(`🔁 Restarting in ${RESTART_DELAY / 1000}s...\n`);
  setTimeout(start, RESTART_DELAY);
}

async function main() {

  try {
    await downloadBinary();
    start();
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }

}

function shutdown() {
  console.log("\n🛑 Shutting down...");

  if (child) {
    child.kill("SIGTERM");
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
