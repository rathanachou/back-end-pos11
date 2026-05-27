const express = require("express");
const router = express.Router();
const {
  generateIndividualKHQR,
  generateMerchantKHQR,
  verifyKHQR,
  decodeKHQR,
  generateDeepLink,
} = require("../utils/payway");

// ─── POST /api/payment/khqr/individual ───────────────────────────────────────
// Generate a KHQR for an individual (personal Bakong account)
//
// Body:
//   bakongAccountID*  string   e.g. "sopheakm@aclb"
//   merchantName*     string   e.g. "Sopheak Mean"
//   merchantCity      string   default "PHNOM PENH"
//   currency          string   "usd" | "khr"   default "usd"
//   amount            number   e.g. 12.50
//   billNumber        string   e.g. "INV-0001"
//   mobileNumber      string   e.g. "85512345678"
//   storeLabel        string   e.g. "Main Branch"
//   terminalLabel     string   e.g. "POS-01"
//   purposeOfTransaction string
//   merchantCategoryCode string default "5999"
//   expiryMinutes     number   default 60
router.post("/khqr/individual", async (req, res) => {
  try {
    const { bakongAccountID, merchantName } = req.body;

    if (!bakongAccountID || !merchantName) {
      return res.status(400).json({
        success: false,
        message: "bakongAccountID and merchantName are required",
      });
    }

    const data = generateIndividualKHQR(req.body);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode ?? null,
    });
  }
});

// ─── POST /api/payment/khqr/merchant ─────────────────────────────────────────
// Generate a KHQR for a merchant (business account)
//
// Body:
//   bakongAccountID*  string   e.g. "shop@aclb"
//   merchantName*     string   e.g. "My Shop Ltd"
//   merchantID*       string   e.g. "MER123456"
//   acquiringBank*    string   e.g. "ACLEDA Bank"
//   merchantCity      string   default "PHNOM PENH"
//   currency          string   "usd" | "khr"   default "usd"
//   amount            number
//   billNumber        string
//   mobileNumber      string
//   storeLabel        string
//   terminalLabel     string
//   purposeOfTransaction string
//   merchantCategoryCode string default "5999"
//   expiryMinutes     number   default 60
router.post("/khqr/merchant", async (req, res) => {
  try {
    const { bakongAccountID, merchantName, merchantID, acquiringBank } = req.body;

    if (!bakongAccountID || !merchantName || !merchantID || !acquiringBank) {
      return res.status(400).json({
        success: false,
        message: "bakongAccountID, merchantName, merchantID, and acquiringBank are required",
      });
    }

    const data = generateMerchantKHQR(req.body);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode ?? null,
    });
  }
});

// ─── POST /api/payment/khqr/verify ───────────────────────────────────────────
// Verify a KHQR string (CRC validation)
//
// Body:
//   qr*   string   the KHQR string to verify
router.post("/khqr/verify", (req, res) => {
  try {
    const { qr } = req.body;

    if (!qr) {
      return res.status(400).json({ success: false, message: "qr is required" });
    }

    const isValid = verifyKHQR(qr);

    return res.status(200).json({
      success: true,
      data: { isValid },
    });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
    });
  }
});

// ─── POST /api/payment/khqr/decode ───────────────────────────────────────────
// Decode a KHQR string into its payment fields
//
// Body:
//   qr*   string   the KHQR string to decode
router.post("/khqr/decode", (req, res) => {
  try {
    const { qr } = req.body;

    if (!qr) {
      return res.status(400).json({ success: false, message: "qr is required" });
    }

    const data = decodeKHQR(qr);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode ?? null,
    });
  }
});

// ─── POST /api/payment/khqr/deeplink ─────────────────────────────────────────
// Generate a Bakong deeplink from a KHQR string
//
// Body:
//   qr*                   string   KHQR string
//   apiUrl*               string   NBC deeplink endpoint
//   appName*              string   Your app name
//   appIconUrl*           string   Your app icon URL
//   appDeepLinkCallBack*  string   Your app deeplink callback URL
router.post("/khqr/deeplink", async (req, res) => {
  try {
    const { qr, apiUrl, appName, appIconUrl, appDeepLinkCallBack } = req.body;

    if (!qr || !apiUrl || !appName || !appIconUrl || !appDeepLinkCallBack) {
      return res.status(400).json({
        success: false,
        message: "qr, apiUrl, appName, appIconUrl, and appDeepLinkCallBack are required",
      });
    }

    const shortLink = await generateDeepLink(apiUrl, qr, {
      appName,
      appIconUrl,
      appDeepLinkCallBack,
    });

    return res.status(200).json({
      success: true,
      data: { shortLink },
    });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode ?? null,
    });
  }
});

module.exports = router;