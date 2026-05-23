const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const logoUploadDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(logoUploadDir)) {
    fs.mkdirSync(logoUploadDir, { recursive: true });
}

const vehicleUploadDir = path.join(__dirname, '../uploads/vehicles');
if (!fs.existsSync(vehicleUploadDir)) {
    fs.mkdirSync(vehicleUploadDir, { recursive: true });
}

// Configure storage for logos
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, logoUploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-randomstring-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// Configure storage for vehicle images
const vehicleStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, vehicleUploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-randomstring-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    // Allowed mime types
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
    }
};

// Create multer instances with configuration
const logoUpload = multer({
    storage: logoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    }
});

const vehicleUpload = multer({
    storage: vehicleStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    }
});

// Middleware to handle single file upload with field name 'logo'
const uploadLogoSingle = logoUpload.single('logo');

// Middleware to handle single file upload with field name 'image'
const uploadVehicleImage = vehicleUpload.single('image');

// Custom middleware to wrap multer and handle errors gracefully for logos
const handleLogoUpload = (req, res, next) => {
    uploadLogoSingle(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    status: false,
                    message: 'File size too large. Maximum allowed size is 5MB'
                });
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    status: false,
                    message: 'Unexpected file field. Expected field: logo'
                });
            }
            return res.status(400).json({
                status: false,
                message: err.message || 'File upload error'
            });
        } else if (err) {
            // Custom errors from fileFilter
            return res.status(400).json({
                status: false,
                message: err.message || 'File upload error'
            });
        }

        // File upload successful, proceed to next middleware
        next();
    });
};

// Custom middleware to wrap multer and handle errors gracefully for vehicle images
const handleVehicleImageUpload = (req, res, next) => {
    uploadVehicleImage(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    status: false,
                    message: 'File size too large. Maximum allowed size is 5MB'
                });
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    status: false,
                    message: 'Unexpected file field. Expected field: image'
                });
            }
            return res.status(400).json({
                status: false,
                message: err.message || 'File upload error'
            });
        } else if (err) {
            // Custom errors from fileFilter
            return res.status(400).json({
                status: false,
                message: err.message || 'File upload error'
            });
        }

        // File upload successful, proceed to next middleware
        next();
    });
};

module.exports = {
    handleLogoUpload,
    handleVehicleImageUpload
};
