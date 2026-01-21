const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* =====================
   ROOM STORAGE
===================== */
const rooms = {};
const COLORS = ["#e6194B", "#3cb44b", "#4363d8", "#f58231", "#911eb4"];

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: {},
      operations: []
    };
  }
  return rooms[roomId];
}

io.on("connection", (socket) => {

  socket.on("room:join", ({ roomId }) => {
    const room = getRoom(roomId);
    socket.join(roomId);

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    room.users[socket.id] = { color };

    socket.emit("room:init", {
      id: socket.id,
      users: room.users,
      operations: room.operations
    });

    socket.to(roomId).emit("user:joined", {
      id: socket.id,
      color
    });

    /* -------- Drawing -------- */
    socket.on("stroke:commit", (stroke) => {
      room.operations.push({
        id: stroke.id,
        type: "stroke",
        stroke,
        active: true
      });
      io.to(roomId).emit("canvas:update", room.operations);
    });

    socket.on("undo", () => {
      for (let i = room.operations.length - 1; i >= 0; i--) {
        if (room.operations[i].active) {
          room.operations[i].active = false;
          break;
        }
      }
      io.to(roomId).emit("canvas:update", room.operations);
    });

    socket.on("redo", () => {
      for (let i = room.operations.length - 1; i >= 0; i--) {
        if (!room.operations[i].active) {
          room.operations[i].active = true;
          break;
        }
      }
      io.to(roomId).emit("canvas:update", room.operations);
    });

    socket.on("cursor:move", (pos) => {
      socket.to(roomId).emit("cursor:update", {
        id: socket.id,
        pos
      });
    });

    socket.on("disconnect", () => {
      delete room.users[socket.id];
      socket.to(roomId).emit("user:left", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

