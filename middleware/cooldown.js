const fs = require("fs");
const path = require("path");
const dbPath = path.join(process.cwd(), "database", "user.json");

function readUsers() {
  if (!fs.existsSync(dbPath)) return [];
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
}

/**
 * Middleware cek cooldown
 * @param {number} duration - durasi cooldown dalam ms (default 5 menit)
 */
function cooldownMiddleware(duration = 5 * 60 * 1000) {
  return (req, res, next) => {
    const username = req.cookies?.sessionUser;
    if (!username) {
      req.cooldownError = "Unauthorized";
      return next();
    }

    let users = readUsers();
    let user = users.find(u => u.username === username);
    if (!user) {
      req.cooldownError = "User tidak ditemukan.";
      return next();
    }

    const now = Date.now();

    if (user.cooldown && now < user.cooldown) {
  const sisaMs = user.cooldown - now; // sisa waktu dalam ms
  const sisaDetik = Math.ceil(sisaMs / 1000);

  const menit = Math.floor(sisaDetik / 60);
  const detik = sisaDetik % 60;

  if (menit > 0) {
    req.cooldownError = `⏳ Tunggu ${menit} menit ${detik} detik lagi sebelum mencoba lagi.`;
  } else {
    req.cooldownError = `⏳ Tunggu ${detik} detik lagi sebelum mencoba lagi.`;
  }
  return next();
}

    if (user.cooldown && now >= user.cooldown) {
      delete user.cooldown;
    }

    user.cooldown = now + duration;
    saveUsers(users);

    next();
  };
}


module.exports = { cooldownMiddleware, readUsers, saveUsers };
