const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* =====================
   GLOBAL STATE
===================== */
let operations = [];
const users = {};
const COLORS = ["#e6194B", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4"];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Assign color
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  users[socket.id] = { color };

  // Send initial state
  socket.emit("init", {
    id: socket.id,
    users,
    operations
  });

  socket.broadcast.emit("user:joined", {
    id: socket.id,
    color
  });

  /* -------- Drawing -------- */
  socket.on("stroke:commit", (stroke) => {
    operations.push({
      id: stroke.id,
      type: "stroke",
      stroke,
      active: true
    });
    io.emit("canvas:update", operations);
  });

  socket.on("undo", () => {
    for (let i = operations.length - 1; i >= 0; i--) {
      if (operations[i].active) {
        operations[i].active = false;
        break;
      }
    }
    io.emit("canvas:update", operations);
  });

  socket.on("redo", () => {
    for (let i = operations.length - 1; i >= 0; i--) {
      if (!operations[i].active) {
        operations[i].active = true;
        break;
      }
    }
    io.emit("canvas:update", operations);
  });

  /* -------- Cursor tracking -------- */
  socket.on("cursor:move", (pos) => {
    socket.broadcast.emit("cursor:update", {
      id: socket.id,
      pos
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete users[socket.id];
    io.emit("user:left", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
