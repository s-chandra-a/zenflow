import mongoose, { Schema } from "mongoose";
import fs from "fs";
import path from "path";

// Define local DB path
const LOCAL_DB_PATH = path.join(process.cwd(), ".antigravity", "db.json");

// Mongoose schemas
const TaskSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  duration: { type: Number, default: 30 },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  period: { type: String, enum: ["today", "tomorrow", "yesterday", "overflow"], default: "today" },
  category: { type: String, default: "work" },
  timeOfDay: { type: String, default: "Morning" },
  completed: { type: Boolean, default: false },
  scheduledTime: { type: String }
}, { timestamps: true });

const HabitSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  time: { type: String, default: "08:00" },
  duration: { type: Number, default: 15 },
  category: { type: String, default: "health" },
  enabled: { type: Boolean, default: true },
  lastCompletedDate: { type: String },
  streak: { type: Number, default: 0 }
}, { timestamps: true });

const SettingsSchema = new Schema({
  key: { type: String, default: "user_settings" },
  keepYesterdayTasks: { type: Boolean, default: true },
  daysCount: { type: Number, default: 0 },
  totalCompletedTasks: { type: Number, default: 0 },
  totalUncompletedTasks: { type: Number, default: 0 },
  lastRolloverDate: { type: String, default: "" }
}, { timestamps: true });

let TaskModel: mongoose.Model<any>;
let HabitModel: mongoose.Model<any>;
let SettingsModel: mongoose.Model<any>;

let isMongoConnected = false;

export async function initDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️ MONGODB_URI is not set in environment variables.");
    console.warn(`📂 Falling back to local file-based database: ${LOCAL_DB_PATH}`);
    initLocalDB();
    return;
  }

  try {
    // Set connection timeout to 5 seconds so we fall back quickly if connection is blocked/slow
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    console.log("🚀 Successfully connected to online MongoDB NoSQL Database!");
    TaskModel = mongoose.model("Task", TaskSchema);
    HabitModel = mongoose.model("Habit", HabitSchema);
    SettingsModel = mongoose.model("Settings", SettingsSchema);
  } catch (err: any) {
    console.error("❌ Failed to connect to online MongoDB:", err.message);
    console.warn(`📂 Falling back to local file-based database: ${LOCAL_DB_PATH}`);
    isMongoConnected = false;
    initLocalDB();
  }
}

export function getDBStatus() {
  const uri = process.env.MONGODB_URI || "";
  let maskedUri = "";
  if (uri) {
    // Mask username and password in connection string for security
    maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  }
  return {
    connected: isMongoConnected,
    type: isMongoConnected ? "mongodb" : "local",
    uri: maskedUri
  };
}

export async function updateMongoURI(newUri: string): Promise<{ success: boolean; message: string }> {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  const uriLine = `MONGODB_URI="${newUri}"`;
  if (envContent.includes("MONGODB_URI=")) {
    envContent = envContent.replace(/MONGODB_URI=["'].*?["']/g, uriLine);
    if (!envContent.includes(uriLine)) {
      envContent = envContent.replace(/MONGODB_URI=.*/g, uriLine);
    }
  } else {
    envContent += `\nMONGODB_URI="${newUri}"\n`;
  }

  try {
    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    process.env.MONGODB_URI = newUri;
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    await initDB();
    
    if (isMongoConnected) {
      return { success: true, message: "Successfully connected to online MongoDB Database!" };
    } else {
      return { success: false, message: "Failed to connect with provided connection string. Reverted to local fallback." };
    }
  } catch (err: any) {
    return { success: false, message: `Error: ${err.message}` };
  }
}


// Local JSON file database helper
function initLocalDB() {
  const defaultSettings = {
    keepYesterdayTasks: true,
    daysCount: 0,
    totalCompletedTasks: 0,
    totalUncompletedTasks: 0,
    lastRolloverDate: ""
  };

  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ tasks: [], habits: [], settings: defaultSettings }, null, 2));
  } else {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.settings) {
        parsed.settings = defaultSettings;
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error("Error healing local settings database:", e);
    }
  }
}

function readLocalDB(): { tasks: any[]; habits: any[]; settings?: any } {
  try {
    const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading local DB file, returning empty state:", e);
    return { tasks: [], habits: [] };
  }
}

function writeLocalDB(data: { tasks: any[]; habits: any[]; settings?: any }) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing to local DB file:", e);
  }
}

export async function getSettings(): Promise<any> {
  const defaultSettings = {
    keepYesterdayTasks: true,
    daysCount: 0,
    totalCompletedTasks: 0,
    totalUncompletedTasks: 0,
    lastRolloverDate: ""
  };

  if (isMongoConnected) {
    try {
      let doc = await SettingsModel.findOne({ key: "user_settings" }).lean();
      if (!doc) {
        doc = await SettingsModel.create({ key: "user_settings", ...defaultSettings });
      }
      const { _id, __v, key, ...rest } = doc;
      return rest;
    } catch (e) {
      console.error("Error fetching settings from MongoDB, falling back to local DB:", e);
    }
  }
  const db = readLocalDB();
  if (!db.settings) {
    db.settings = defaultSettings;
    writeLocalDB(db);
  }
  return db.settings;
}

export async function syncSettings(settings: any): Promise<void> {
  const sanitizedSettings = {
    keepYesterdayTasks: typeof settings.keepYesterdayTasks === "boolean" ? settings.keepYesterdayTasks : true,
    daysCount: typeof settings.daysCount === "number" ? settings.daysCount : 0,
    totalCompletedTasks: typeof settings.totalCompletedTasks === "number" ? settings.totalCompletedTasks : 0,
    totalUncompletedTasks: typeof settings.totalUncompletedTasks === "number" ? settings.totalUncompletedTasks : 0,
    lastRolloverDate: typeof settings.lastRolloverDate === "string" ? settings.lastRolloverDate : ""
  };

  if (isMongoConnected) {
    try {
      await SettingsModel.updateOne(
        { key: "user_settings" },
        { $set: sanitizedSettings },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error("Error syncing settings to MongoDB, falling back to local DB:", e);
    }
  }
  const db = readLocalDB();
  db.settings = sanitizedSettings;
  writeLocalDB(db);
}

export async function getTasks(): Promise<any[]> {
  if (isMongoConnected) {
    try {
      const docs = await TaskModel.find({}).lean();
      // Map MongoDB _id properties or keep the string id structure intact
      return docs.map((doc: any) => {
        const { _id, __v, ...rest } = doc;
        return rest;
      });
    } catch (e) {
      console.error("Error fetching tasks from MongoDB, falling back to local DB:", e);
    }
  }
  return readLocalDB().tasks;
}

export async function syncTasks(tasks: any[]): Promise<void> {
  // Clean tasks to ensure they match our schema fields before saving
  const sanitizedTasks = tasks.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || "",
    duration: typeof t.duration === "number" ? t.duration : 30,
    priority: t.priority || "medium",
    period: t.period || "today",
    category: t.category || "work",
    timeOfDay: t.timeOfDay || "Morning",
    completed: !!t.completed,
    scheduledTime: t.scheduledTime || undefined
  }));

  if (isMongoConnected) {
    try {
      await TaskModel.deleteMany({});
      if (sanitizedTasks.length > 0) {
        await TaskModel.insertMany(sanitizedTasks);
      }
      return;
    } catch (e) {
      console.error("Error syncing tasks to MongoDB, falling back to local DB:", e);
    }
  }
  const db = readLocalDB();
  db.tasks = sanitizedTasks;
  writeLocalDB(db);
}

export async function getHabits(): Promise<any[]> {
  if (isMongoConnected) {
    try {
      const docs = await HabitModel.find({}).lean();
      return docs.map((doc: any) => {
        const { _id, __v, ...rest } = doc;
        return rest;
      });
    } catch (e) {
      console.error("Error fetching habits from MongoDB, falling back to local DB:", e);
    }
  }
  return readLocalDB().habits;
}

export async function syncHabits(habits: any[]): Promise<void> {
  const sanitizedHabits = habits.map((h: any) => ({
    id: h.id,
    title: h.title,
    description: h.description || "",
    time: h.time || "08:00",
    duration: typeof h.duration === "number" ? h.duration : 15,
    category: h.category || "health",
    enabled: !!h.enabled,
    lastCompletedDate: h.lastCompletedDate,
    streak: typeof h.streak === "number" ? h.streak : 0
  }));

  if (isMongoConnected) {
    try {
      await HabitModel.deleteMany({});
      if (sanitizedHabits.length > 0) {
        await HabitModel.insertMany(sanitizedHabits);
      }
      return;
    } catch (e) {
      console.error("Error syncing habits to MongoDB, falling back to local DB:", e);
    }
  }
  const db = readLocalDB();
  db.habits = sanitizedHabits;
  writeLocalDB(db);
}
