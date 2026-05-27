const axios = require('axios');

const sendTelegramNotification = async (order) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const itemList = order.items
    .map((item, i) => `   ${i + 1}. ${item.name} x${item.qty} — $${item.price}`)
    .join('\n');

  const message = `
🛒 <b>New Order Received!</b>
━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID:</b> ${order.id}
👤 <b>Customer:</b> ${order.customerName}
📦 <b>Items:</b>
${itemList}
💰 <b>Total:</b> $${order.total}
🕐 <b>Time:</b> ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━
  `.trim();

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      }
    );
    console.log(' Telegram notification sent!');
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
  }
};

module.exports = sendTelegramNotification;