const express = require("express");
const app = express();
const port = 3000;

// Middleware to read JSON body
app.use(express.json());

// In-memory data
let products = [
  {
    id: 1,
    name: "Apple",
    price: 20,
    qty: 10,
  },
];

/**
 * READ - Get all products
 */
app.get("/products", (req, res) => {
  res.json(products);
});

/**
 * READ - Get product by ID
 */
app.get("/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json(product);
});

/**
 * CREATE - Add new product
 */
app.post("/products", (req, res) => {
  const { name, price, qty } = req.body;

  if (!name || price == null || qty == null) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const newProduct = {
    id: products.length ? products[products.length - 1].id + 1 : 1,
    name,
    price,
    qty,
  };

  products.push(newProduct);

  res.status(201).json({
    message: "Product created successfully",
    data: newProduct,
  });
});

/**
 * UPDATE - Update product by ID
 */
app.put("/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { name, price, qty } = req.body;

  const productIndex = products.findIndex((p) => p.id === id);

  if (productIndex === -1) {
    return res.status(404).json({ message: "Product not found" });
  }

  products[productIndex] = {
    ...products[productIndex],sdf,
    name: name ?? products[productIndex].name,
    price: price ?? products[productIndex].price,
    qty: qty ?? products[productIndex].qty,
  };

  res.json({
    message: "Product updated successfully",
    data: products[productIndex],
  });
});

/**
 * DELETE - Remove product by ID
 */
app.delete("/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const productIndex = products.findIndex((p) => p.id === id);

  if (productIndex === -1) {
    return res.status(404).json({ message: "Product not found" });
  }

  const deletedProduct = products.splice(productIndex, 1);

  res.json({
    message: "Product deleted successfully",
    data: deletedProduct[0],
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
