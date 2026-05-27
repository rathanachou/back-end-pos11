const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Product, ProductImage, Category } = require("../../models");
const { Op, fn, col, where } = require("sequelize");
const bwipjs = require("bwip-js");
const PDFDocument = require("pdfkit");
const generateBarcodePDF = require('../utils/generateBarcodePDF');
const { requireRole } = require("../middlewares/authMiddleware");
const router = express.Router();





router.get("/", async (req, res) => {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (req.query.search) {
      const search = req.query.search.replace(/\s+/g, "").toLowerCase();
      conditions.push(
        where(
          fn("REPLACE", fn("LOWER", col("Product.name")), " ", ""),
          { [Op.like]: `%${search}%` }
        )
      );
    }

    if (req.query.categoryId) {
      conditions.push({ categoryId: req.query.categoryId });
    }

    if (req.query.inStock === "false") {
      conditions.push({ qty: { [Op.lte]: 0 } });
    } else if (req.query.maxQty !== undefined) {
      conditions.push({ qty: { [Op.lte]: Number(req.query.maxQty) } });
    }

    const whereCondition = conditions.length > 0
      ? { [Op.and]: conditions }
      : {};

    const { rows: products, count: total } = await Product.findAndCountAll({
      where: whereCondition,
      distinct: true,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "productId", "imageUrl", "fileName"],
        },
      ],
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: "Products fetched successfully",
      data: products,
      pagination: {
        currentPage: page,
        limit,
        total,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── GET: Low Stock ───────────────────────────────────────
router.get("/stock/low", async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 10;

    const products = await Product.findAll({
      where: { qty: { [Op.lte]: threshold } },
      order: [["qty", "ASC"]],
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        {
          model: ProductImage,
          as: "productImages",
          attributes: ["id", "imageUrl"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Low stock products fetched successfully",
      data: products,
      total: products.length,
      threshold,
    });
  } catch (error) {
    console.error("Low stock error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── GET: Stock Info ──────────────────────────────────────
router.get("/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      attributes: ["id", "name", "qty"],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    const qty = product.qty;
    const stockStatus =
      qty === 0  ? "OUT_OF_STOCK" :
      qty <= 10  ? "LOW_STOCK"    : "IN_STOCK";

    res.json({
      success: true,
      message: "Stock fetched successfully",
      data: { productId: product.id, name: product.name, qty, stockStatus },
    });
  } catch (error) {
    console.error("Get stock error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get('/barcodes/print', async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'price'],
    });

    if (!products.length) {
      return res.status(404).json({ success: false, message: 'No products found' });
    }

    const pdf = await generateBarcodePDF(products);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=product-labels.pdf');
    res.send(pdf);
  } catch (error) {
    console.error('Barcode PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET: Single Barcode PDF ──────────────────────────────
router.get('/:id/barcode/print', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      attributes: ['id', 'name', 'price'],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const pdf = await generateBarcodePDF([product]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=label-${product.id}.pdf`);
    res.send(pdf);
  } catch (error) {
    console.error('Barcode PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { name, price, categoryId, isActive, qty } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "name, price, categoryId are required",
      });
    }

    const createdProduct = await Product.create({
      name,
      price,
      categoryId,
      qty: qty || 0,
      isActive: isActive ?? true,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: createdProduct,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
router.post("/:id/upload", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    // ─── Check product exists ─────────────────────────
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    // ─── Check file exists (express-fileupload uses req.files) ──
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Field name must be 'file'",
      });
    }

    const file = req.files.file;

    // ─── Validate image type ──────────────────────────
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed (jpeg, png, webp, gif)",
      });
    }

    // ─── Save file to disk ────────────────────────────
    const uploadDir = path.join(__dirname, "../../uploads/products");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext        = path.extname(file.name);
    const uniqueName = `${uuidv4()}${ext}`;
    const filePath   = path.join(uploadDir, uniqueName);

    await file.mv(filePath);

    // ─── Build public URL ─────────────────────────────
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/products/${uniqueName}`;

    // ─── Save to DB ───────────────────────────────────
    const productImage = await ProductImage.create({
      productId: id,
      imageUrl,
      fileName:  file.name,
    });

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data: productImage,
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// ─── DELETE: Delete Product Image (admin only)
router.delete("/images/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ProductImage.findByPk(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: `Image id=${id} not found`,
      });
    }

    // ─── Delete file from disk ────────────────────────
    const filename = path.basename(image.imageUrl);
    const filePath = path.join(__dirname, "../../uploads/products", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await image.destroy();

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── PUT: Update Product (admin only) ────────────────────
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, categoryId, isActive, qty } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    await product.update({ name, price, categoryId, qty, isActive });

    const updatedProduct = await Product.findByPk(id, {
      include: [{ model: Category, as: "category" }],
    });

    res.json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── DELETE: Delete Product (admin only) ─────────────────
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    await product.destroy();

    res.json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH: Stock In (admin only) ────────────────────────
router.patch("/:id/stock/in", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { qty } = req.body;

    if (!qty || isNaN(qty) || Number(qty) <= 0) {
      return res.status(400).json({
        success: false,
        message: "qty must be a positive number",
      });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    const oldQty = product.qty;
    const newQty = oldQty + Number(qty);
    await product.update({ qty: newQty });

    res.json({
      success: true,
      message: `Stock added successfully (+${qty})`,
      data: {
        productId:   product.id,
        name:        product.name,
        previousQty: oldQty,
        addedQty:    Number(qty),
        currentQty:  newQty,
      },
    });
  } catch (error) {
    console.error("Stock in error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── PATCH: Stock Out (admin only) ───────────────────────
router.patch("/:id/stock/out", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { qty } = req.body;

    if (!qty || isNaN(qty) || Number(qty) <= 0) {
      return res.status(400).json({
        success: false,
        message: "qty must be a positive number",
      });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product id=${id} not found`,
      });
    }

    if (Number(qty) > product.qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.qty}, Requested: ${qty}`,
      });
    }

    const oldQty = product.qty;
    const newQty = oldQty - Number(qty);
    await product.update({ qty: newQty });

    res.json({
      success: true,
      message: `Stock removed successfully (-${qty})`,
      data: {
        productId:   product.id,
        name:        product.name,
        previousQty: oldQty,
        removedQty:  Number(qty),
        currentQty:  newQty,
      },
    });
  } catch (error) {
    console.error("Stock out error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;