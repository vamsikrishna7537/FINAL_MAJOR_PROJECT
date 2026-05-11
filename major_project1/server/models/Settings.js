import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  autoAlert: { type: Boolean, default: false },
  minRisk: { type: Number, default: 70, min: 0, max: 100 }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

/** Get settings (singleton). */
export async function getSettings() {
  const doc = await Settings.findOne().lean();
  return { autoAlert: doc?.autoAlert ?? false, minRisk: doc?.minRisk ?? 70 };
}

/** Update settings. */
export async function updateSettings(data) {
  const doc = await Settings.findOneAndUpdate(
    {},
    { $set: { autoAlert: data.autoAlert ?? false, minRisk: data.minRisk ?? 70 } },
    { new: true, upsert: true }
  ).lean();
  return { autoAlert: !!doc.autoAlert, minRisk: doc.minRisk ?? 70 };
}

export default Settings;
