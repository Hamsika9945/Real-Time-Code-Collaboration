// socket-server/index.js
import 'dotenv/config'; // Load JDoodle API keys from .env
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import axios from "axios";
import ts from "typescript"; // For transpiling TypeScript

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Track users in rooms
const roomUsers = {};

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  // User joins a room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);

    io.in(roomId).emit("user-joined", { userId: socket.id });
    io.to(roomId).emit("user-count", roomUsers[roomId].size);
  });

  // Broadcast code changes
  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-update", code);
  });

  // Handle language change
  socket.on("language-change", ({ roomId, language }) => {
    socket.to(roomId).emit("language-update", language);
  });

  // Run code via JDoodle API
  socket.on("run-code", async ({ roomId, code, language }) => {
    try {
      let jdoodleLang = "nodejs";
      let finalCode = code;
      let versionIndex = "0";

      switch (language) {
        case "typescript":
          finalCode = ts.transpile(code, { module: ts.ModuleKind.CommonJS });
          break;
        case "javascript":
          jdoodleLang = "nodejs";
          break;
        case "python":
          jdoodleLang = "python3";
          versionIndex = "4"; // Python 3.11
          break;
        case "java":
          jdoodleLang = "java";
          versionIndex = "4"; // Java 20
          break;
        case "cpp":
          jdoodleLang = "cpp14";
          versionIndex = "5"; // C++14
          break;
        case "csharp":
          jdoodleLang = "csharp";
          versionIndex = "3"; // C# 12
          break;
        case "go":
          jdoodleLang = "go";
          versionIndex = "4"; // Go 1.21
          break;
        case "rust":
          jdoodleLang = "rust";
          versionIndex = "4"; // Rust 1.73
          break;
      }

      const response = await axios.post("https://api.jdoodle.com/v1/execute", {
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script: finalCode,
        language: jdoodleLang,
        versionIndex,
      });

      io.to(roomId).emit("code-output", response.data.output);
    } catch (err) {
      console.error(err.response?.data || err.message);
      io.to(roomId).emit(
        "code-output",
        "Error executing code: " + (err.response?.data?.message || err.message)
      );
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
    for (const [roomId, users] of Object.entries(roomUsers)) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit("user-left", socket.id);
        io.to(roomId).emit("user-count", users.size);
        if (users.size === 0) delete roomUsers[roomId];
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on http://localhost:${PORT}`);
});

export default app;
