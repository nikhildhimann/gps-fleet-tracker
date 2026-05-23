const ImportExportService = require("./service");
const {
  createImportFailureNotification,
  createImportNotification,
} = require("../notifications/producers");

exports.importData = async (req, res) => {
  try {

    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: insufficient role",
      });
    }

    const { entity } = req.params;
    const result = await ImportExportService.importData({
      entity: (entity || "").toLowerCase(),
      file: req.file,
      req,
    });

    await createImportNotification({
      entity: (entity || "").toLowerCase(),
      result,
      req,
      file: req.file,
    });

    return res.status(200).json(result);
  } catch (error) {
    await createImportFailureNotification({
      entity: (req.params.entity || "").toLowerCase(),
      req,
      file: req.file,
      error,
    });

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Import failed",
      data: error.data || null,
    });
  }
};

exports.exportData = async (req, res) => {
  try {
    if (!["admin", "superadmin", "driver"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Forbidden: insufficient role",
      });
    }

    const { entity } = req.params;
    await ImportExportService.exportData({
      entity: (entity || "").toLowerCase(),
      req,
      res,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(error.status || 500).json({
        status: false,
        message: error.message || "Export failed",
      });
    }
    return null;
  }
};
