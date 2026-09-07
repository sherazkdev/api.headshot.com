import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import type { AppConfig } from "../config/index.js";
import { PLAY_LIST_PRICES } from "../config/credits.js";
import { errors } from "./errors.js";

type ServiceAccount = { client_email?: string; private_key?: string };
type PlayMoney = { currencyCode?: string; units?: string; nanos?: number };
type PlayLineItem = {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: { recurringPrice?: PlayMoney };
  prepaidPlan?: { price?: PlayMoney };
};

export type PlaySubscriptionResult = {
  active: boolean;
  expiryMs: number | null;
  productId?: string;
  verified: boolean;
  amount: number;
  currency: string;
};

function parseServiceAccount(raw: string): ServiceAccount | null {
  if (!raw.trim()) return null;
  try {
    if (existsSync(raw)) return JSON.parse(readFileSync(raw, "utf8")) as ServiceAccount;
    if (!raw.trim().startsWith("{")) {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded) as ServiceAccount;
    }
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function b64urlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function moneyFromPlay(price: PlayMoney | undefined, fallbackProductId: string): { amount: number; currency: string } {
  if (price && (price.units !== undefined || price.nanos !== undefined)) {
    const units = Number(price.units ?? 0);
    const nanos = Number(price.nanos ?? 0);
    const amount = units + nanos / 1_000_000_000;
    if (Number.isFinite(amount) && amount >= 0) {
      return { amount, currency: price.currencyCode || "USD" };
    }
  }
  const catalog = PLAY_LIST_PRICES[fallbackProductId as keyof typeof PLAY_LIST_PRICES];
  return catalog ?? { amount: 0, currency: "USD" };
}

async function googleAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const claim = b64urlJson({
    iss: email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${signer.sign(privateKey.replace(/\\n/g, "\n"), "base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw errors.server("Google Play authentication failed");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw errors.server("Google Play token missing");
  return json.access_token;
}

export function requirePlayPackage(config: AppConfig): string {
  const pkg = config.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  if (!pkg || pkg === "com.yourcompany.headshotai") {
    throw errors.server("Set GOOGLE_PLAY_PACKAGE_NAME to the real Android applicationId from Play Console");
  }
  return pkg;
}

export async function verifyPlaySubscription(
  config: AppConfig,
  input: { packageName?: string; purchaseToken?: string; productId: string },
): Promise<PlaySubscriptionResult> {
  const catalog = PLAY_LIST_PRICES[input.productId as keyof typeof PLAY_LIST_PRICES] ?? { amount: 0, currency: "USD" };

  if (!config.GOOGLE_PLAY_VERIFY_ENABLED) {
    if (!input.purchaseToken) throw errors.validation("purchaseToken is required");
    return {
      active: true,
      expiryMs: null,
      productId: input.productId,
      verified: false,
      amount: catalog.amount,
      currency: catalog.currency,
    };
  }

  const sa = parseServiceAccount(config.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  if (!sa?.client_email || !sa.private_key) {
    throw errors.server("GOOGLE_PLAY_VERIFY_ENABLED=true but GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is empty");
  }
  if (!input.purchaseToken) throw errors.validation("purchaseToken is required");
  const pkgName = input.packageName?.trim() || requirePlayPackage(config);
  const token = await googleAccessToken(sa.client_email, sa.private_key);
  const pkg = encodeURIComponent(pkgName);
  const purchaseToken = encodeURIComponent(input.purchaseToken);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) throw errors.notFound("Purchase not found on Google Play");
  if (!res.ok) throw errors.server(`Google Play verify failed (${res.status})`);
  const json = (await res.json()) as {
    subscriptionState?: string;
    lineItems?: PlayLineItem[];
  };
  const line = json.lineItems?.[0];
  const active = json.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE";
  const expiry = line?.expiryTime ? Date.parse(line.expiryTime) : null;
  const productId = line?.productId ?? input.productId;
  const money = moneyFromPlay(line?.autoRenewingPlan?.recurringPrice ?? line?.prepaidPlan?.price, input.productId);
  return {
    active,
    expiryMs: Number.isFinite(expiry) ? expiry : null,
    productId,
    verified: true,
    amount: money.amount,
    currency: money.currency,
  };
}
