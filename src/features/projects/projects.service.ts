import { errors } from "../../lib/errors.js";
import { ProjectModel } from "../../models/index.js";
import { pageMeta } from "../../lib/zod.js";

export class ProjectsService {
  async list(uid: string | undefined, page: number, perPage: number) {
    const q: Record<string, unknown> = { deletedAt: null };
    if (uid) q.uid = uid;
    const [items, total] = await Promise.all([
      ProjectModel.find(q)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      ProjectModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  async get(uid: string, id: string) {
    const doc = await ProjectModel.findOne({ projectId: id, uid, deletedAt: null });
    if (!doc) throw errors.notFound("Project not found");
    return doc;
  }

  async create(
    uid: string,
    input: {
      name: string;
      toolType: string;
      styleId?: string;
      outfitId?: string;
      backgroundId?: string;
      poseId?: string;
      gender?: string;
      purpose?: string;
      sourcePhotoUrl?: string;
      resultImageUrl?: string;
      brandingScore?: number;
      brandingStrengths?: string[];
      profileReviewData?: Record<string, unknown>;
      isFavorite?: boolean;
    },
  ) {
    const projectId = crypto.randomUUID();
    return ProjectModel.create({ projectId, uid, status: "completed", ...input });
  }

  async patch(uid: string, id: string, patch: { name?: string; isFavorite?: boolean }) {
    const doc = await this.get(uid, id);
    if (patch.name !== undefined) doc.name = patch.name;
    if (patch.isFavorite !== undefined) doc.isFavorite = patch.isFavorite;
    await doc.save();
    return doc;
  }

  async remove(uid: string, id: string) {
    const doc = await this.get(uid, id);
    doc.deletedAt = new Date();
    await doc.save();
    return { deleted: true };
  }
}
