const mongoose = require("mongoose"); // ✅ Import mongoose once

class ajModel {
  constructor(modelName, schemaDefinition, transformFn = null) {
    this.modelName = modelName;
    this.model = null;
    this.schema = new mongoose.Schema(schemaDefinition, {
      versionKey: false,
      timestamps: true, // Adds createdAt & updatedAt fields automatically
      toJSON: {
        transform: function (doc, ret, options) {
          return transformFn ? transformFn(ret, options) : ret;
        },
      },
    });
  }

  index(fields, options = {}) {
    this.schema.index(fields, options);
    return this;
  }

  getModel() {
    if (!this.model) {
      this.model = mongoose.model(this.modelName, this.schema);
    }
    return this.model;
  }
}

// Export both the class and mongoose
module.exports = { ajModel, mongoose };
