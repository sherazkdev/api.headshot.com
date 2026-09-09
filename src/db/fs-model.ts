import { FieldValue, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";

type Filter = Record<string, unknown>;
type Update = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp);
}

function toJs(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (Array.isArray(value)) return value.map(toJs);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJs(v);
    return out;
  }
  return value;
}

function getPath(doc: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), doc);
}

function neq(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) return actual == null;
  return actual === expected;
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function isAlreadyExists(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string };
  return e?.code === 6 || e?.code === "already-exists" || /ALREADY_EXISTS/i.test(String(e?.message ?? err));
}

function matches(doc: Record<string, unknown>, filter: Filter): boolean {
  for (const [key, raw] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(raw)) {
      if (!raw.some((part) => matches(doc, part as Filter))) return false;
      continue;
    }
    if (key === "$and" && Array.isArray(raw)) {
      if (!raw.every((part) => matches(doc, part as Filter))) return false;
      continue;
    }
    const actual = key === "__v" ? Number(doc.__v ?? 0) : doc[key];
    if (raw instanceof RegExp) {
      if (!raw.test(String(actual ?? ""))) return false;
      continue;
    }
    if (isPlainObject(raw) && ("$regex" in raw || "$ne" in raw || "$gte" in raw || "$gt" in raw || "$lte" in raw || "$lt" in raw || "$in" in raw)) {
      if ("$regex" in raw) {
        const re = new RegExp(String(raw.$regex), String(raw.$options ?? ""));
        if (!re.test(String(actual ?? ""))) return false;
      }
      if ("$ne" in raw && neq(actual, raw.$ne)) return false;
      if ("$gte" in raw && !(actual instanceof Date ? actual.getTime() >= new Date(raw.$gte as string | Date).getTime() : Number(actual) >= Number(raw.$gte))) return false;
      if ("$gt" in raw && !(actual instanceof Date ? actual.getTime() > new Date(raw.$gt as string | Date).getTime() : Number(actual) > Number(raw.$gt))) return false;
      if ("$lte" in raw && !(actual instanceof Date ? actual.getTime() <= new Date(raw.$lte as string | Date).getTime() : Number(actual) <= Number(raw.$lte))) return false;
      if ("$lt" in raw && !(actual instanceof Date ? actual.getTime() < new Date(raw.$lt as string | Date).getTime() : Number(actual) < Number(raw.$lt))) return false;
      if ("$in" in raw && Array.isArray(raw.$in) && !raw.$in.includes(actual)) return false;
      continue;
    }
    if (key === "__v") {
      if (Number(actual) !== Number(raw)) return false;
      continue;
    }
    if (raw == null) {
      if (actual != null) return false;
      continue;
    }
    if (actual !== raw) return false;
  }
  return true;
}

export class DuplicateKeyError extends Error {
  readonly code = 11000;
  constructor() {
    super("duplicate key");
  }
}

export type FsDoc<T> = T & {
  _id: string;
  save: () => Promise<FsDoc<T>>;
  toObject: () => Record<string, unknown>;
};

export class FsModel<T extends object> {
  readonly modelName: string;

  constructor(
    private readonly db: () => Firestore,
    readonly collectionName: string,
    private readonly idField?: string,
    private readonly idBuilder?: (data: Record<string, unknown>) => string,
  ) {
    this.modelName = collectionName;
  }

  private col() {
    return this.db().collection(this.collectionName);
  }

  private wrap(id: string, data: Record<string, unknown>): FsDoc<T> {
    const plain = { ...data, _id: id } as Record<string, unknown>;
    if (plain.__v === undefined) plain.__v = 0;
    if (this.collectionName === "users") {
      if (plain.accountStatus == null) plain.accountStatus = "active";
      if (plain.credits == null) plain.credits = 0;
      if (plain.passCredits == null) plain.passCredits = 0;
      if (plain.adRewardClaimed == null) plain.adRewardClaimed = false;
      if (plain.isPremium == null) plain.isPremium = false;
      if (plain.premiumStatus == null) plain.premiumStatus = "free";
      if (plain.welcomeBonusGranted == null) plain.welcomeBonusGranted = false;
      if (plain.emailVerified == null) plain.emailVerified = false;
    }
    const doc = plain as FsDoc<T>;
    Object.defineProperty(doc, "save", {
      enumerable: false,
      configurable: true,
      value: async () => {
        const { _id, save, toObject, ...rest } = doc as FsDoc<T> & { save?: unknown; toObject?: unknown };
        await this.col()
          .doc(String(_id))
          .set(stripUndefined({ ...(rest as Record<string, unknown>), updatedAt: new Date() }), { merge: true });
        return doc;
      },
    });
    Object.defineProperty(doc, "toObject", {
      enumerable: false,
      configurable: true,
      value: () => {
        const copy = { ...plain };
        delete (copy as { save?: unknown }).save;
        delete (copy as { toObject?: unknown }).toObject;
        return copy;
      },
    });
    return doc;
  }

  private fromSnap(snap: QueryDocumentSnapshot): FsDoc<T> {
    return this.wrap(snap.id, toJs(snap.data()) as Record<string, unknown>);
  }

  private async all(): Promise<FsDoc<T>[]> {
    const snap = await this.col().get();
    return snap.docs.map((d) => this.fromSnap(d));
  }

  private async filtered(filter: Filter = {}): Promise<FsDoc<T>[]> {
    if (this.idField && typeof filter[this.idField] === "string" && Object.keys(filter).length === 1) {
      const hit = await this.col().doc(String(filter[this.idField])).get();
      if (!hit.exists) return [];
      const doc = this.wrap(hit.id, toJs(hit.data()) as Record<string, unknown>);
      return matches(doc as unknown as Record<string, unknown>, filter) ? [doc] : [];
    }
    if (typeof filter._id === "string" && Object.keys(filter).length === 1) {
      const hit = await this.col().doc(String(filter._id)).get();
      if (!hit.exists) return [];
      return [this.wrap(hit.id, toJs(hit.data()) as Record<string, unknown>)];
    }
    const rows = await this.all();
    if (!Object.keys(filter).length) return rows;
    return rows.filter((row) => matches(row as unknown as Record<string, unknown>, filter));
  }

  private query(filter: Filter = {}) {
    const self = this;
    let sortSpec: Record<string, 1 | -1> | undefined;
    let skipN = 0;
    let limitN = 0;
    let selectFields: string[] | undefined;
    const exec = async () => {
      let rows = await self.filtered(filter);
      if (sortSpec) {
        const [field, dir] = Object.entries(sortSpec)[0] ?? [];
        if (field && dir) {
          rows = [...rows].sort((a, b) => {
            const av = (a as Record<string, unknown>)[field];
            const bv = (b as Record<string, unknown>)[field];
            const an = av instanceof Date ? av.getTime() : av;
            const bn = bv instanceof Date ? bv.getTime() : bv;
            if (an === bn) return 0;
            if (an == null) return 1;
            if (bn == null) return -1;
            return (an as number) > (bn as number) ? dir : -dir;
          });
        }
      }
      if (skipN) rows = rows.slice(skipN);
      if (limitN) rows = rows.slice(0, limitN);
      const fields = selectFields;
      if (fields?.length) {
        rows = rows.map((row) => {
          const picked: Record<string, unknown> = { _id: (row as FsDoc<T>)._id };
          for (const f of fields) picked[f] = (row as Record<string, unknown>)[f];
          return self.wrap(String(picked._id), picked);
        });
      }
      return rows;
    };
    const q = {
      sort(spec: Record<string, 1 | -1>) {
        sortSpec = spec;
        return q;
      },
      skip(n: number) {
        skipN = n;
        return q;
      },
      limit(n: number) {
        limitN = n;
        return q;
      },
      select(fields: string | Record<string, number>) {
        selectFields = typeof fields === "string" ? fields.split(/\s+/).filter(Boolean) : Object.keys(fields);
        return q;
      },
      then<TResult1 = FsDoc<T>[], TResult2 = never>(
        onfulfilled?: ((value: FsDoc<T>[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return exec().then(onfulfilled, onrejected);
      },
    };
    return q;
  }

  find(filter: Filter = {}) {
    return this.query(filter);
  }

  async findOne(filter: Filter = {}): Promise<FsDoc<T> | null> {
    const rows = await this.filtered(filter);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<FsDoc<T> | null> {
    const hit = await this.col().doc(String(id)).get();
    if (!hit.exists) return null;
    return this.wrap(hit.id, toJs(hit.data()) as Record<string, unknown>);
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return (await this.filtered(filter)).length;
  }

  async create(input: Partial<T>): Promise<FsDoc<T>> {
    const now = new Date();
    const data = { ...input, createdAt: (input as { createdAt?: Date }).createdAt ?? now, updatedAt: now } as Record<string, unknown>;
    if (data.__v === undefined) data.__v = 0;
    const id =
      (this.idBuilder ? this.idBuilder(data) : undefined) ||
      (this.idField && data[this.idField] ? String(data[this.idField]) : crypto.randomUUID());
    if (this.idField && !data[this.idField]) data[this.idField] = id;
    const ref = this.col().doc(id);
    try {
      await ref.create(stripUndefined(data));
    } catch (err) {
      if (isAlreadyExists(err)) throw new DuplicateKeyError();
      throw err;
    }
    return this.wrap(id, data);
  }

  async insertMany(rows: Array<Partial<T>>): Promise<FsDoc<T>[]> {
    const out: FsDoc<T>[] = [];
    for (const row of rows) out.push(await this.create(row));
    return out;
  }

  async updateOne(filter: Filter, update: Update, opts: { upsert?: boolean } = {}) {
    let doc = await this.findOne(filter);
    if (!doc) {
      if (opts.upsert) {
        const setOnInsert = (update.$setOnInsert as Record<string, unknown> | undefined) ?? {};
        const set = (update.$set as Record<string, unknown> | undefined) ?? {};
        await this.create({ ...setOnInsert, ...set, ...filter } as Partial<T>);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    await this.applyUpdate(doc, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(filter: Filter, update: Update, opts: { new?: boolean } = {}): Promise<FsDoc<T> | null> {
    const id = this.docIdFromFilter(filter);
    if (id) {
      return this.db().runTransaction(async (tx) => {
        const ref = this.col().doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const current = this.wrap(snap.id, toJs(snap.data()) as Record<string, unknown>);
        if (!matches(current as unknown as Record<string, unknown>, filter)) return null;
        if (!this.passesUpdateFilter(current, filter)) return null;
        const { payload, next } = this.patchDoc(current, update);
        tx.set(ref, payload, { merge: true });
        return opts.new === false ? current : next;
      });
    }
    const doc = await this.findOne(filter);
    if (!doc) return null;
    if (!this.passesUpdateFilter(doc, filter)) return null;
    const next = await this.applyUpdate(doc, update);
    return opts.new === false ? doc : next;
  }

  async deleteMany(filter: Filter) {
    const rows = await this.filtered(filter);
    for (const row of rows) await this.col().doc(String((row as FsDoc<T>)._id)).delete();
    return { deletedCount: rows.length };
  }

  async aggregate<R = Record<string, unknown>>(pipeline: Array<Record<string, unknown>>): Promise<R[]> {
    let rows: Record<string, unknown>[] = (await this.all()) as unknown as Record<string, unknown>[];
    for (const stage of pipeline) {
      if (stage.$match) rows = rows.filter((row) => matches(row, stage.$match as Filter));
      if (stage.$group) {
        const group = stage.$group as Record<string, unknown>;
        const buckets = new Map<string, Record<string, unknown>>();
        for (const row of rows) {
          const rawId = group._id;
          const idVal =
            rawId === null || rawId === undefined
              ? null
              : typeof rawId === "string" && rawId.startsWith("$")
                ? getPath(row, rawId.slice(1))
                : rawId;
          const key = JSON.stringify(idVal);
          if (!buckets.has(key)) {
            const acc: Record<string, unknown> = { _id: idVal };
            for (const [outKey, spec] of Object.entries(group)) {
              if (outKey === "_id") continue;
              if (isPlainObject(spec) && "$sum" in spec) acc[outKey] = 0;
            }
            buckets.set(key, acc);
          }
          const acc = buckets.get(key)!;
          for (const [outKey, spec] of Object.entries(group)) {
            if (outKey === "_id") continue;
            if (!isPlainObject(spec) || !("$sum" in spec)) continue;
            const sum = spec.$sum;
            const add = sum === 1 ? 1 : Number(getPath(row, String(sum).replace(/^\$/, "")) ?? 0);
            acc[outKey] = Number(acc[outKey] ?? 0) + add;
          }
        }
        rows = [...buckets.values()];
      }
    }
    return rows as R[];
  }

  async syncIndexes(): Promise<Record<string, string>> {
    return { firestore: "skip" };
  }

  private passesUpdateFilter(doc: FsDoc<T>, filter: Filter): boolean {
    const rec = doc as unknown as Record<string, unknown>;
    if (typeof filter.__v === "number" && Number(rec.__v ?? 0) !== filter.__v) return false;
    for (const [key, raw] of Object.entries(filter)) {
      if (!isPlainObject(raw) || !("$gte" in raw)) continue;
      if (Number(rec[key] ?? 0) < Number(raw.$gte)) return false;
    }
    return true;
  }

  private docIdFromFilter(filter: Filter): string | undefined {
    if (this.idField && typeof filter[this.idField] === "string") return String(filter[this.idField]);
    if (typeof filter._id === "string") return String(filter._id);
    return undefined;
  }

  private patchDoc(doc: FsDoc<T>, update: Update): { payload: Record<string, unknown>; next: FsDoc<T> } {
    const rec = doc as unknown as Record<string, unknown>;
    const set = (update.$set as Record<string, unknown> | undefined) ?? {};
    const inc = (update.$inc as Record<string, number> | undefined) ?? {};
    const payload: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(set)) {
      rec[k] = v;
      payload[k] = v;
    }
    for (const [k, v] of Object.entries(inc)) {
      rec[k] = Number(rec[k] ?? 0) + Number(v);
      payload[k] = FieldValue.increment(Number(v));
    }
    if (!update.$set && !update.$inc && !update.$setOnInsert) {
      for (const [k, v] of Object.entries(update)) {
        if (k.startsWith("$")) continue;
        rec[k] = v;
        payload[k] = v;
      }
    }
    return { payload, next: doc };
  }

  private async applyUpdate(doc: FsDoc<T>, update: Update): Promise<FsDoc<T>> {
    const { payload, next } = this.patchDoc(doc, update);
    await this.col().doc(String(doc._id)).set(payload, { merge: true });
    return next;
  }
}
