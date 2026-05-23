const socketIo = require("socket.io");

let io;

const initializeSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*", // Adjust this to your specific client URL in production
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        // console.log(`🔌 New client connected: ${socket.id}`);

        // Join a room based on Organization ID (for Admins seeing all devices in their org)
        socket.on("join_organization", (organizationId) => {
            socket.join(`org_${organizationId}`);
            // console.log(`Socket ${socket.id} joined organization room: org_${organizationId}`);
        });

        // Join a room for a specific device (for live tracking a single vehicle)
        socket.on("join_device", (imei) => {
            socket.join(`device_${imei}`);
            // console.log(`Socket ${socket.id} joined device room: device_${imei}`);
        });

        // Leave rooms
        socket.on("leave_organization", (organizationId) => {
            socket.leave(`org_${organizationId}`);
            // console.log(`Socket ${socket.id} left organization room: org_${organizationId}`);
        });

        socket.on("leave_device", (imei) => {
            socket.leave(`device_${imei}`);
            console.log(`Socket ${socket.id} left device room: device_${imei}`);
        });

        // Handle incoming GPS data (if devices send data via Socket)
        // NOTE: If devices send data via HTTP/TCP to a separate port, 
        // you would call emitGpsUpdate from your controller instead.
        socket.on("send_gps_data", (data) => {
            console.log("Received GPS Data:", data);

            // Broadcast to specific device room
            io.to(`device_${data.imei}`).emit("gps_update", data);

            // Broadcast to organization room (if data contains organizationId)
            if (data.organizationId) {
                io.to(`org_${data.organizationId}`).emit("gps_update", data);
            }
        });

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initializeSocket, getIo };
