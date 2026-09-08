export type RemoteConfigDoc = {
  key: string;
  type: "json" | "secret" | "string";
  value: string;
  status: "published" | "modified" | "remove_required";
  version: number;
  publishedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};
