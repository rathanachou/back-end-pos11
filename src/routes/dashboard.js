const express = require("express");
const router = express.Router();
const { Order, OrderDetail, Product, Customer } = require("../../models");
const { Op, fn, col, QueryTypes } = require("sequelize");

// ─── TOP PRODUCTS ─────────────────────────────────
router.get("/top-products", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const topProducts = await OrderDetail.findAll({
      attributes: [
        "productName",
        [fn("SUM", col("qty")), "totalQty"],
        [fn("SUM", col("amount")), "totalAmount"],
      ],
      group: ["productName"],
      order: [[fn("SUM", col("qty")), "DESC"]],
      limit,
      raw: true,
    });

  
    const parsed = topProducts.map(p => ({
      ...p,
      totalQty: Number(p.totalQty) || 0,
      totalAmount: Number(p.totalAmount) || 0,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── SUMMARY ─────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 10; 
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayData, weeklyData, monthlyData,
           totalProducts, totalCustomers, lowStock, topProducts] =
      await Promise.all([
        Order.findOne({
          attributes: [
            [fn("SUM", col("total")), "totalSales"],
            [fn("COUNT", col("id")), "totalOrders"],
          ],
          where: { createdAt: { [Op.between]: [todayStart, todayEnd] } },
          raw: true,
        }),
        Order.findOne({
          attributes: [
            [fn("SUM", col("total")), "totalSales"],
            [fn("COUNT", col("id")), "totalOrders"],
          ],
          where: { createdAt: { [Op.gte]: weekStart } },
          raw: true,
        }),
        Order.findOne({
          attributes: [
            [fn("SUM", col("total")), "totalSales"],
            [fn("COUNT", col("id")), "totalOrders"],
          ],
          where: { createdAt: { [Op.gte]: monthStart } },
          raw: true,
        }),
        Product.count(),
        Customer.count(),
        Product.findAll({
          where: { qty: { [Op.lt]: threshold } }, 
          attributes: ["id", "name", "qty", "price"],
          order: [["qty", "ASC"]], 
          limit: 10,
        }),
        OrderDetail.findAll({
          attributes: [
            "productName",
            [fn("SUM", col("qty")), "totalQty"],
            [fn("SUM", col("amount")), "totalAmount"],
          ],
          group: ["productName"],
          order: [[fn("SUM", col("qty")), "DESC"]],
          limit: 5,
          raw: true,
        }),
      ]);

    res.json({
      success: true,
      data: {
        today: {
          totalSales: Number(todayData?.totalSales) || 0,
          totalOrders: Number(todayData?.totalOrders) || 0,
        },
        weekly: {
          totalSales: Number(weeklyData?.totalSales) || 0,
          totalOrders: Number(weeklyData?.totalOrders) || 0,
        },
        monthly: {
          totalSales: Number(monthlyData?.totalSales) || 0,
          totalOrders: Number(monthlyData?.totalOrders) || 0,
        },
        totalProducts,
        totalCustomers,
        lowStock,
        topProducts: topProducts.map(p => ({
          ...p,
          totalQty: Number(p.totalQty) || 0,
          totalAmount: Number(p.totalAmount) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── MONTHLY SALES ─────────────────────────────────
router.get("/sales/monthly", async (req, res) => {
  try {
    const sequelize = Order.sequelize;

    const data = await sequelize.query(
      `SELECT 
        TO_CHAR("createdAt", 'YYYY-MM') AS month,
        SUM(total::numeric) AS "totalSales",
        COUNT(id) AS "totalOrders"
       FROM "Orders"
       WHERE "createdAt" >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
       ORDER BY month ASC`,
      { type: QueryTypes.SELECT }
    );

    const parsed = data.map(row => ({
      month: row.month,
      totalSales: Number(row.totalSales) || 0,
      totalOrders: Number(row.totalOrders) || 0,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── SALES BY CATEGORY ──────────────────────────────
router.get("/sales/by-category", async (req, res) => {
  try {
    const sequelize = OrderDetail.sequelize;

    const data = await sequelize.query(
      `SELECT 
        c.name AS category,
        SUM(od.amount::numeric) AS "totalSales",
        SUM(od.qty) AS "totalOrders"
       FROM "OrderDetails" od
       JOIN "Products" p ON od."productId" = p.id
       JOIN "Categories" c ON p."categoryId" = c.id
       GROUP BY c.name
       ORDER BY "totalSales" DESC`,
      { type: QueryTypes.SELECT }
    );

  
    const parsed = data.map(row => ({
      category: row.category,
      totalSales: Number(row.totalSales) || 0,
      totalOrders: Number(row.totalOrders) || 0,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;