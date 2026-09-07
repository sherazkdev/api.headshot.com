import { RemoteConfigModel } from "../../models/index.js";

const DEFAULTS: Array<{ key: string; type: "json" | "secret"; value: string; status: "published" | "remove_required" }> = [
  {
    key: "headshot_ads_test_json",
    type: "json",
    status: "published",
    value: JSON.stringify({ banner: "ca-app-pub-test", rewarded: "ca-app-pub-test" }),
  },
  {
    key: "headshot_ads_release_json",
    type: "json",
    status: "published",
    value: JSON.stringify({ banner: "", rewarded: "" }),
  },
  {
    key: "pass_expiry_json",
    type: "json",
    status: "published",
    value: JSON.stringify({
      use_testing_durations: false,
      weekly_minutes: 5,
      monthly_minutes: 5,
      yearly_minutes: 30,
      weekly_credits: 500,
      monthly_credits: 3000,
      yearly_credits: 13000,
      renewal_skew_seconds: 21600,
    }),
  },
  {
    key: "force_update_json",
    type: "json",
    status: "published",
    value: JSON.stringify({ min_version: "1.0.0", force: false }),
  },
  {
    key: "gemini_api_key",
    type: "secret",
    status: "remove_required",
    value: "",
  },
];

export class RemoteConfigService {
  async ensure() {
    for (const row of DEFAULTS) {
      await RemoteConfigModel.updateOne({ key: row.key }, { $setOnInsert: row }, { upsert: true });
    }
  }

  async list() {
    await this.ensure();
    return RemoteConfigModel.find().sort({ key: 1 });
  }

  async save(key: string, value: string, publishedBy: string) {
    const doc = await RemoteConfigModel.findOne({ key });
    if (!doc) return RemoteConfigModel.create({ key, value, type: "json", status: "modified", publishedBy });
    doc.value = value;
    doc.status = key === "gemini_api_key" ? "remove_required" : "modified";
    doc.publishedBy = publishedBy;
    await doc.save();
    return doc;
  }

  async publish(publishedBy: string) {
    const docs = await RemoteConfigModel.find({ status: "modified" });
    for (const doc of docs) {
      if (doc.key === "gemini_api_key") continue;
      doc.status = "published";
      doc.version += 1;
      doc.publishedBy = publishedBy;
      await doc.save();
    }
    return this.list();
  }
}
