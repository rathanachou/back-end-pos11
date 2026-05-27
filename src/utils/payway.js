require("dotenv").config();

const {
  BakongKHQR,
  khqrData,
  IndividualInfo,
  MerchantInfo,
  SourceInfo,
} = require("bakong-khqr");

// ─── ENV CONFIG ──────────────────────────────────────────────────────────────

const CONFIG = {
  // Individual / shared
  bakongAccountID:        process.env.BAKONG_ACCOUNT_ID            || "",
  merchantName:           process.env.MERCHANT_NAME                || "",
  merchantCity:           process.env.MERCHANT_CITY                || "PHNOM PENH",
  // Merchant only
  merchantID:             process.env.MERCHANT_ID                  || "",
  acquiringBank:          process.env.ACQUIRING_BANK               || "",
  // Optional shared
  merchantCategoryCode:   process.env.MERCHANT_CATEGORY_CODE       || "5999",
  currency:               (process.env.KHQR_CURRENCY || "usd").toLowerCase(),
  expiryMinutes:          Number(process.env.KHQR_EXPIRY_MINUTES)  || 60,
  // Deeplink
  deeplinkApiUrl:         process.env.BAKONG_DEEPLINK_API_URL      || "",
  appName:                process.env.BAKONG_APP_NAME              || "",
  appIconUrl:             process.env.BAKONG_APP_ICON_URL          || "",
  appDeepLinkCallback:    process.env.BAKONG_APP_DEEPLINK_CALLBACK || "",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Resolve khqrData.currency numeric value from string "usd" | "khr"
 * Default: USD (840)
 */
function resolveCurrency(currency) {
  const key = (currency || CONFIG.currency).toLowerCase();
  return khqrData.currency[key] !== undefined
    ? khqrData.currency[key]
    : khqrData.currency.usd;
}

/**
 * Build expiration timestamp in milliseconds (as string, required by SDK)
 */
function buildExpiration(expiryMinutes) {
  const minutes = (expiryMinutes !== undefined && expiryMinutes !== null)
    ? Number(expiryMinutes)
    : CONFIG.expiryMinutes;
  return String(Date.now() + minutes * 60 * 1000);
}

// ─── GENERATE INDIVIDUAL KHQR ────────────────────────────────────────────────
/**
 * Generate KHQR for an individual (personal Bakong account).
 *
 * Constructor used (from SDK source):
 *   new IndividualInfo(bakongAccountID, merchantName, merchantCity, optional)
 *
 * @param {object}  params
 * @param {string}  params.bakongAccountID        required  e.g. "sopheakm@aclb"    max 32
 * @param {string}  params.merchantName           required  e.g. "Sopheak Mean"     max 25
 * @param {string}  [params.merchantCity]                   default from .env       max 15
 * @param {string}  [params.currency]                       "usd"|"khr"  default .env
 * @param {number}  [params.amount]                         e.g. 12.50
 * @param {string}  [params.accountInformation]             account number / phone  max 32
 * @param {string}  [params.acquiringBank]                  acquiring bank name     max 32
 * @param {string}  [params.billNumber]                     invoice / order ref     max 25
 * @param {string}  [params.mobileNumber]                   e.g. "85512345678"      max 25
 * @param {string}  [params.storeLabel]                     e.g. "Main Branch"      max 25
 * @param {string}  [params.terminalLabel]                  e.g. "POS-01"           max 25
 * @param {string}  [params.purposeOfTransaction]           e.g. "Order payment"    max 25
 * @param {string}  [params.languagePreference]             e.g. "km"               max 2
 * @param {string}  [params.merchantNameAlternateLanguage]  Khmer name              max 25
 * @param {string}  [params.merchantCityAlternateLanguage]  Khmer city              max 15
 * @param {string}  [params.upiMerchantAccount]             UPI account info        max 31
 * @param {string}  [params.merchantCategoryCode]           default .env            max 4
 * @param {number}  [params.expiryMinutes]                  QR valid duration, default .env
 *
 * @returns {{ qr: string, md5: string }}
 */
function generateIndividualKHQR(params = {}) {
  const bakongAccountID = params.bakongAccountID || CONFIG.bakongAccountID;
  const merchantName    = params.merchantName    || CONFIG.merchantName;
  const merchantCity    = params.merchantCity    || CONFIG.merchantCity;

  if (!bakongAccountID) throw new Error("bakongAccountID is required");
  if (!merchantName)    throw new Error("merchantName is required");

  // optional object — only defined keys, SDK strips null/undefined/empty internally
  const optional = {
    currency:                        resolveCurrency(params.currency),
    amount:                          params.amount,
    accountInformation:              params.accountInformation,
    acquiringBank:                   params.acquiringBank,
    billNumber:                      params.billNumber,
    mobileNumber:                    params.mobileNumber,
    storeLabel:                      params.storeLabel,
    terminalLabel:                   params.terminalLabel,
    purposeOfTransaction:            params.purposeOfTransaction,
    languagePreference:              params.languagePreference,
    merchantNameAlternateLanguage:   params.merchantNameAlternateLanguage,
    merchantCityAlternateLanguage:   params.merchantCityAlternateLanguage,
    upiMerchantAccount:              params.upiMerchantAccount,
    merchantCategoryCode:            params.merchantCategoryCode || CONFIG.merchantCategoryCode,
    expirationTimestamp:             buildExpiration(params.expiryMinutes),
  };

  const individualInfo = new IndividualInfo(bakongAccountID, merchantName, merchantCity, optional);

  const KHQR   = new BakongKHQR();
  const result = KHQR.generateIndividual(individualInfo);

  if (result.status.code !== 0) {
    const err = new Error(result.status.message || "Failed to generate Individual KHQR");
    err.errorCode = result.status.errorCode;
    throw err;
  }

  return { qr: result.data.qr, md5: result.data.md5 };
}

// ─── GENERATE MERCHANT KHQR ──────────────────────────────────────────────────
/**
 * Generate KHQR for a merchant (business account).
 *
 * Constructor used (from SDK source):
 *   new MerchantInfo(bakongAccountID, merchantName, merchantCity, merchantID, acquiringBank, optional)
 *
 * @param {object}  params
 * @param {string}  params.bakongAccountID        required  e.g. "shop@aclb"        max 32
 * @param {string}  params.merchantName           required  e.g. "My Shop Ltd"      max 25
 * @param {string}  params.merchantID             required  e.g. "MER123456"        max 32
 * @param {string}  params.acquiringBank          required  e.g. "ACLEDA Bank"      max 32
 * @param {string}  [params.merchantCity]                   default from .env       max 15
 * @param {string}  [params.currency]                       "usd"|"khr"  default .env
 * @param {number}  [params.amount]                         e.g. 25.00
 * @param {string}  [params.billNumber]                     invoice / order ref     max 25
 * @param {string}  [params.mobileNumber]                   e.g. "85512345678"      max 25
 * @param {string}  [params.storeLabel]                     e.g. "Main Branch"      max 25
 * @param {string}  [params.terminalLabel]                  e.g. "POS-01"           max 25
 * @param {string}  [params.purposeOfTransaction]           e.g. "Order payment"    max 25
 * @param {string}  [params.languagePreference]             e.g. "km"               max 2
 * @param {string}  [params.merchantNameAlternateLanguage]  Khmer name              max 25
 * @param {string}  [params.merchantCityAlternateLanguage]  Khmer city              max 15
 * @param {string}  [params.upiMerchantAccount]             UPI account info        max 31
 * @param {string}  [params.merchantCategoryCode]           default .env            max 4
 * @param {number}  [params.expiryMinutes]                  QR valid duration, default .env
 *
 * @returns {{ qr: string, md5: string }}
 */
function generateMerchantKHQR(params = {}) {
  const bakongAccountID = params.bakongAccountID || CONFIG.bakongAccountID;
  const merchantName    = params.merchantName    || CONFIG.merchantName;
  const merchantCity    = params.merchantCity    || CONFIG.merchantCity;
  const merchantID      = params.merchantID      || CONFIG.merchantID;
  const acquiringBank   = params.acquiringBank   || CONFIG.acquiringBank;

  if (!bakongAccountID) throw new Error("bakongAccountID is required");
  if (!merchantName)    throw new Error("merchantName is required");
  if (!merchantID)      throw new Error("merchantID is required");
  if (!acquiringBank)   throw new Error("acquiringBank is required");

  const optional = {
    currency:                        resolveCurrency(params.currency),
    amount:                          params.amount,
    billNumber:                      params.billNumber,
    mobileNumber:                    params.mobileNumber,
    storeLabel:                      params.storeLabel,
    terminalLabel:                   params.terminalLabel,
    purposeOfTransaction:            params.purposeOfTransaction,
    languagePreference:              params.languagePreference,
    merchantNameAlternateLanguage:   params.merchantNameAlternateLanguage,
    merchantCityAlternateLanguage:   params.merchantCityAlternateLanguage,
    upiMerchantAccount:              params.upiMerchantAccount,
    merchantCategoryCode:            params.merchantCategoryCode || CONFIG.merchantCategoryCode,
    expirationTimestamp:             buildExpiration(params.expiryMinutes),
  };

  const merchantInfo = new MerchantInfo(bakongAccountID, merchantName, merchantCity, merchantID, acquiringBank, optional);

  const KHQR   = new BakongKHQR();
  const result = KHQR.generateMerchant(merchantInfo);

  if (result.status.code !== 0) {
    const err = new Error(result.status.message || "Failed to generate Merchant KHQR");
    err.errorCode = result.status.errorCode;
    throw err;
  }

  return { qr: result.data.qr, md5: result.data.md5 };
}

// ─── VERIFY KHQR ─────────────────────────────────────────────────────────────
/**
 * Verify a KHQR string via CRC check.
 * Uses static method: BakongKHQR.verify(qrString)
 *
 * @param {string} qrString
 * @returns {boolean}
 */
function verifyKHQR(qrString) {
  if (!qrString) throw new Error("qrString is required");
  const result = BakongKHQR.verify(qrString);
  return result.isValid === true;
}

// ─── DECODE KHQR ─────────────────────────────────────────────────────────────
/**
 * Decode a KHQR string into its payment fields.
 * Uses static method: BakongKHQR.decode(qrString)
 *
 * @param {string} qrString
 * @returns {object}
 */
function decodeKHQR(qrString) {
  if (!qrString) throw new Error("qrString is required");

  const result = BakongKHQR.decode(qrString);

  if (result.status.code !== 0) {
    const err = new Error(result.status.message || "Failed to decode KHQR");
    err.errorCode = result.status.errorCode;
    throw err;
  }

  return result.data;
}

// ─── DECODE NON-KHQR ─────────────────────────────────────────────────────────
/**
 * Decode a non-KHQR EMV QR string into a raw tag map.
 * Uses static method: BakongKHQR.decodeNonKhqr(qrString)
 *
 * @param {string} qrString
 * @returns {object}
 */
function decodeNonKHQR(qrString) {
  if (!qrString) throw new Error("qrString is required");

  const result = BakongKHQR.decodeNonKhqr(qrString);

  if (result.status.code !== 0) {
    const err = new Error(result.status.message || "Failed to decode non-KHQR");
    err.errorCode = result.status.errorCode;
    throw err;
  }

  return result.data;
}

// ─── GENERATE DEEPLINK ───────────────────────────────────────────────────────
/**
 * Generate a Bakong short deeplink from a KHQR string.
 * Uses static method: BakongKHQR.generateDeepLink(url, qr, sourceInfo)
 *
 * SourceInfo constructor (from SDK source):
 *   new SourceInfo(appIconUrl, appName, appDeepLinkCallback)
 *
 * @param {string}  qrString
 * @param {object}  [options]
 * @param {string}  [options.apiUrl]               NBC deeplink endpoint (or BAKONG_DEEPLINK_API_URL)
 * @param {string}  [options.appName]              Your app name        (or BAKONG_APP_NAME)
 * @param {string}  [options.appIconUrl]           Your app icon URL    (or BAKONG_APP_ICON_URL)
 * @param {string}  [options.appDeepLinkCallback]  Callback deeplink    (or BAKONG_APP_DEEPLINK_CALLBACK)
 *
 * @returns {Promise<string>} shortLink
 */
async function generateDeepLink(qrString, options = {}) {
  if (!qrString) throw new Error("qrString is required");

  const apiUrl             = options.apiUrl             || CONFIG.deeplinkApiUrl;
  const appName            = options.appName            || CONFIG.appName;
  const appIconUrl         = options.appIconUrl         || CONFIG.appIconUrl;
  const appDeepLinkCallback = options.appDeepLinkCallback || CONFIG.appDeepLinkCallback;

  if (!apiUrl)  throw new Error("apiUrl is required (or set BAKONG_DEEPLINK_API_URL in .env)");
  if (!appName) throw new Error("appName is required (or set BAKONG_APP_NAME in .env)");

  // SourceInfo(appIconUrl, appName, appDeepLinkCallback)
  const sourceInfo = new SourceInfo(appIconUrl, appName, appDeepLinkCallback);

  const result = await BakongKHQR.generateDeepLink(apiUrl, qrString, sourceInfo);

  if (result.status.code !== 0) {
    const err = new Error(result.status.message || "Failed to generate deeplink");
    err.errorCode = result.status.errorCode;
    throw err;
  }

  return result.data.shortLink;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  generateIndividualKHQR,
  generateMerchantKHQR,
  verifyKHQR,
  decodeKHQR,
  decodeNonKHQR,
  generateDeepLink,
};