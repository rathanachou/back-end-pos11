const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { User } = require("../../models");
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, gender } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }


    const hashedPassword = await bcrypt.hash(password, 10);


    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      gender,
    });


    const userData = user.toJSON();
    delete userData.password;

    return res.status(201).json({
      message: "User registered successfully",
      data: userData,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: `User email=${email} not found`,
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.firstName + user.lastName,
        role:     user.role, 
      },
      "sala-express",
    );

    return res.json({
      message: "User logged in successfully",
      data: token,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;
