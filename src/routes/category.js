const express = require("express");
const { Category, Product } = require("../../models");
const { Op } = require("sequelize");
const { requireRole } = require("../middlewares/authMiddleware"); // ✅ import

const router = express.Router();

// ─── GET: All Categories (admin + cashier) ────────────────
router.get("", async (req, res) => {
  try {
    let whereCondition = {};
    if (req.query.search) {
      whereCondition.name = { [Op.iLike]: `%${req.query.search}%` };
    }

    const categories = await Category.findAll({
      where: whereCondition,
      include: [{ model: Product, as: "products" }],
    });

    res.json({ message: "Category fetched successfully", data: categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET: List (admin + cashier) ──────────────────────────
router.get("/list", async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json({ message: "Category fetched successfully", data: categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST: Create Category (admin only)  ────────────────
router.post("", requireRole("admin"), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const created = await Category.create({ name, isActive });
    res.json({ message: "Category created successfully", data: created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUT: Update Category (admin only)  ────────────────
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id }   = req.params;
    const { name } = req.body;

    let category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: `Category id=${id} not found` });
    }

    category = await category.update({ name });
    res.json({ message: "Category updated successfully", data: category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── DELETE: Delete Category (admin only)  ─────────────
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: `Category id=${id} not found` });
    }

    await category.destroy();
    res.json({ message: "Category deleted successfully", data: category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;