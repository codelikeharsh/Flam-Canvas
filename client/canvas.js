/* =====================================================
   CANVAS SETUP
===================================================== */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

ctx.lineCap = "round";
ctx.lineJoin = "round";

/* =====================================================
   GLOBAL STATE (SERVER CONTROLLED)
===================================================== */
let operations = [];
let currentStroke = [];
let isDrawing = false;

/* =====================================================
   TOOL STATE (LOCAL UI)
===================================================== */
let currentColor = "#000000";
let brushWidth = 5;
let tool = "brush"; // brush | eraser

/* =====================================================
   EXPOSE UPDATE FUNCTION (FOR socket.js)
===================================================== */
window.updateOperations = function (ops) {
  operations = ops;
  redrawCanvas();
};

/* =====================================================
   UI ELEMENT REFERENCES
===================================================== */
const colorPickerInput = document.getElementById("colorPicker");
const brushSizeInput   = document.getElementById("brushSize");
const brushBtn         = document.getElementById("brushBtn");
const eraserBtn        = document.getElementById("eraserBtn");
const undoBtn          = document.getElementById("undoBtn");
const redoBtn          = document.getElementById("redoBtn");

/* =====================================================
   UI EVENTS
===================================================== */
colorPickerInput.onchange = (e) => {
  currentColor = e.target.value;
};

brushSizeInput.oninput = (e) => {
  brushWidth = parseInt(e.target.value);
};

brushBtn.onclick = () => setTool("brush");
eraserBtn.onclick = () => setTool("eraser");

undoBtn.onclick = () => socket.emit("undo");
redoBtn.onclick = () => socket.emit("redo");

function setTool(selected) {
  tool = selected;

  brushBtn.classList.remove("active");
  eraserBtn.classList.remove("active");

  if (tool === "brush") brushBtn.classList.add("active");
  if (tool === "eraser") eraserBtn.classList.add("active");
}

/* =====================================================
   POINTER EVENTS (MOUSE + TOUCH)
===================================================== */
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);

  isDrawing = true;
  currentStroke = [getPoint(e)];
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDrawing) return;
  e.preventDefault();

  const point = getPoint(e);
  currentStroke.push(point);
  drawLive(currentStroke);

  // cursor indicator for other users
  socket.emit("cursor:move", point);
});

canvas.addEventListener("pointerup", (e) => {
  if (!isDrawing) return;
  e.preventDefault();

  isDrawing = false;
  canvas.releasePointerCapture(e.pointerId);

  const stroke = {
    id: crypto.randomUUID(),
    points: [...currentStroke],
    color: currentColor,
    size: tool === "eraser" ? brushWidth * 2 : brushWidth,
    tool
  };

  socket.emit("stroke:commit", stroke);
});

/* =====================================================
   REDRAW FULL CANVAS (GLOBAL STATE)
===================================================== */
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  operations.forEach(op => {
    if (!op.active) return;
    drawStroke(op.stroke);
  });
}

/* =====================================================
   DRAW STORED STROKES
===================================================== */
function drawStroke(stroke) {
  ctx.save();

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = stroke.size;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }

  for (let i = 1; i < stroke.points.length; i++) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[i - 1].x, stroke.points[i - 1].y);
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

/* =====================================================
   LIVE DRAWING (LOCAL PREVIEW)
===================================================== */
function drawLive(points) {
  if (points.length < 2) return;

  ctx.save();

  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = brushWidth * 2;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushWidth;
  }

  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.restore();
}

/* =====================================================
   UTILS
===================================================== */
function getPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}
