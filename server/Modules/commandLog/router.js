const express = require("express");
const router = express.Router();

// dummy test route
router.get("/", (req, res) => {
  res.json({
    status: true,
    message: "CommandLog router is working",
  });
});

module.exports = router;
