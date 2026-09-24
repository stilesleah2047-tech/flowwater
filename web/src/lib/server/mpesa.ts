import axios from "axios";
import { getEnv } from "@/lib/server/env";

function baseUrl(): string {
  return getEnv().DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDarajaToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const env = getEnv();
  const credentials = Buffer.from(`${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`).toString(
    "base64"
  );

  const res = await axios.get(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    timeout: 10_000,
  });

  const token = res.data.access_token as string;
  const expiresIn = Number(res.data.expires_in ?? 3599);
  cachedToken = { token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

function darajaTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function darajaPassword(shortcode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

export interface StkPushParams {
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
  const env = getEnv();
  const token = await getDarajaToken();
  const timestamp = darajaTimestamp();
  const password = darajaPassword(env.DARAJA_SHORTCODE, env.DARAJA_PASSKEY, timestamp);

  const body = {
    BusinessShortCode: env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: env.DARAJA_TRANSACTION_TYPE,
    Amount: Math.round(params.amount),
    PartyA: params.phone,
    PartyB: env.DARAJA_SHORTCODE,
    PhoneNumber: params.phone,
    CallBackURL: env.DARAJA_CALLBACK_URL,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  const res = await axios.post(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, body, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 15_000,
  });

  return res.data as StkPushResult;
}

export interface StkQueryResult {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

export async function queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
  const env = getEnv();
  const token = await getDarajaToken();
  const timestamp = darajaTimestamp();
  const password = darajaPassword(env.DARAJA_SHORTCODE, env.DARAJA_PASSKEY, timestamp);

  const res = await axios.post(
    `${baseUrl()}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: 10_000,
    }
  );

  return res.data as StkQueryResult;
}
