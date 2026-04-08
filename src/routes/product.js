const app = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Product, ProductImage, Category } = require("../../models");
const { Op } = require("sequelize");

const router = app.Router();

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    let whereCondition = {};
    if (req.query.search) {
      whereCondition.name = {
        [Op.iLike]: `%${req.query.search}%`,
      };
    }

    if (req.query.categoryId) {
      whereCondition.categoryId = {
        [Op.eq]: req.query.categoryId,
      };
    }

    const offset = (page - 1) * limit;

    const { rows: products, count: total } = await Product.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ['id','name']
        },
        {
          model:  ProductImage,
          as: "ProductImage",
          attributes: ["id", "productId",  "imageUrl",  "filename"]
        },
      ],
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      message: "Product fetched successfully",
      data: products,
      pagination: {
        currentPage: page,
        limit,
        total,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (error) {
    console.log("Fetching product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ ADD THIS — Create product
router.post("/", async (req, res) => {
  try {
    const { name, price, categoryId, isActive, qty } = req.body;

    const createdProduct = await Product.create({
      name,
      price,
      categoryId,
      isActive,
      qty,
    });

    const productWithCategory = await Product.findByPk(createdProduct.id, {
      include: [{ model: Category, as: "category" }],
    });

    res.json({
      message: "Product created successfully",
      data: productWithCategory,
    });
  } catch (error) {
    console.log("Creating product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, categoryId, isActive, qty } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: `Product id=${id} not found` });
    }

    await product.update({ name, price, categoryId, isActive, qty });

    const updatedProduct = await Product.findByPk(id, {
      include: [{ model: Category, as: "category" }],
    });

    return res.json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.log("Updating product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/upload", async (req, res) => {
  try {
    const { file } = req.files;
    const productId = req.params.id;

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: `Product id=${productId} not found` });
    }

    const fileName = `${uuidv4()}${path.extname(file.name)}`;
    const uploadPath = path.join(process.cwd(), "uploads/products", fileName);
    await file.mv(uploadPath);

    const domain = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${domain}/uploads/products/${fileName}`;

    const savedImage = await ProductImage.create({
      productId,
      imageUrl,
      fileName: file.name,
    });

    res.json({ message: "Upload image successfully", data: savedImage });
  } catch (error) {
    console.log("Upload image error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/images/:imageId/download", async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ message: `Image id=${imageId} not found` });
    }

    const fileName = image.imageUrl.split("/").pop();
    const filePath = path.join(process.cwd(), "uploads/products", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.download(filePath, image.fileName);
  } catch (error) {
    console.log("Download image error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;