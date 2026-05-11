const app = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Product, ProductImage, Category } = require("../../models");
const { Op, fn, col, where } = require("sequelize");

const router = app.Router();

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    let whereCondition = {};

    if (req.query.search) {
      const search = req.query.search.replace(/\s+/g, "").toLowerCase();

      whereCondition = where(
        fn("REPLACE", fn("LOWER", col("Product.name")), " ", ""),
        {
          [Op.like]: `%${search}%`,
        },
      );
    }

    if (req.query.categoryId) {
      whereCondition.categoryId = {
        [Op.eq]: req.query.categoryId,
      };
    }

    const offset = (page - 1) * limit;
    
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
    console.log("Creating product error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("", async (req, res) => {
  router; // const name = req.body.name
  // const price = req.body.price
  // const categroyId = req.body.categroyId
  try {
    const { name, price, categoryId, isActive, qty } = req.body;

    const createdProduct = await Product.create({
      name,
      price,
      categoryId,
      qty,
      isActive,
    });
    res.json({
      message: "Product created successfully",
      data: createdProduct,
    });
  } catch (error) {
    console.log("Creating product error:", error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, categoryId, isActive, qty } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        message: `Product id=${id} not found`,
      });
    }

    await product.update({
      name,
      price,
      categoryId,
      qty,
      isActive,
    });

    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: Category,
          as: "category",
        },
      ],
    });

    res.json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.log("Updating product error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        message: `Product id=${id} not found`,
      });
    }

    await product.destroy();

    return res.json({
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message,
    });
  }
});

// Image upload
router.post("/:id/upload", async (req, res) => {
  try {
    // const file = req.files.file;
    // const productId = req.files.productId

    const { file } = req.files;
    const productId = req.params.id;

    // validate product id
    const product = await Product.findByPk(productId);
    if (!product) {
      res.json({
        message: `Product id=${productId} not found`,
      });
    }

    console.log("File", file);

    // UUI + file extension
    const fileName = `${uuidv4()}${path.extname(file.name)}`;

    //  Upload file to folder uploads/products
    //  Create file upload path
    const uploadPath = path.join(process.cwd(), "uploads/products", fileName);

    await file.mv(uploadPath);

    // Domain + fileName // domain.com/uploads/products/9871923712.png
    const domain = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${domain}/uploads/products/${fileName}`;

    const savedImage = await ProductImage.create({
      productId,
      imageUrl,
      fileName: file.name,
    });

    res.json({
      message: "Upload image successfully",
      data: savedImage,
    });
  } catch (error) {}
});

router.get("/images/:imageId/download", async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId);
    if (!image) {
      res.json({
        message: `Product image id=${imageId} not found`,
      });
    }

    const fileName = image.imageUrl.split("/").pop();
    console.log("File name", fileName);

    const filePath = path.join(process.cwd(), "uploads/products", fileName);

    if (!fs.existsSync(filePath)) {
      res.json({
        message: "File not found",
      });
    }

    console.log("Image data", image);
    res.download(filePath, image.fileName);
  } catch (error) {}
});


router.delete("/images/:imageId", async (req, res) => {
  const { imageId } = req.params;

 const image = await ProductImage.findOne({
    where: {
      id: imageId
    }
  })

  if(!image){
    return res.status(404).json({
  message: `Product Image id=${imageId} not found`
});
  }

  // remove image from folder uploads
  const fileName = image.imageUrl.split("/").pop()

  const filePath = path.join(process.cwd(), "uploads/products", fileName)

  if(fs.existsSync(filePath)){
    fs.unlinkSync(filePath)
  }

  // remove data from db
  await image.destroy()

  return res.json({
    message: "Product Image deleted successfully"
  })

});
module.exports = router;