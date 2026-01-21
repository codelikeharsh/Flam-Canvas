/* =====================================================
   CANVAS SETUP
===================================================== */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

ctx.lineCap = "round";
ctx.lineJoin = "round";

/* =====================================================
   STATE
===================================================== */
let operations = [];
let isDrawing = false;

/* live drawing buffers */
let livePoints = [];
let shapePreview = null;

/* =====================================================
   TOOL STATE
===================================================== */
let tool = "brush";
let currentColor = "#000000";
let brushWidth = 5;

/* =====================================================
   SOCKET HOOK
===================================================== */
window.updateOperations = function (ops) {
  operations = ops;
  redrawCanvas();
};

/* =====================================================
   UI
===================================================== */
const colorPickerInput = document.getElementById("colorPicker");
const brushSizeInput = document.getElementById("brushSize");

const toolButtons = {
  brush: document.getElementById("brushBtn"),
  eraser: document.getElementById("eraserBtn"),
  line: document.getElementById("lineBtn"),
  rect: document.getElementById("rectBtn"),
  circle: document.getElementById("circleBtn"),
  triangle: document.getElementById("triangleBtn")
};

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

colorPickerInput.onchange = e => currentColor = e.target.value;
brushSizeInput.oninput = e => brushWidth = parseInt(e.target.value);

Object.entries(toolButtons).forEach(([name, btn]) => {
  btn.onclick = () => setTool(name);
});

undoBtn.onclick = () => socket.emit("undo");
redoBtn.onclick = () => socket.emit("redo");

function setTool(t) {
  tool = t;
  Object.values(toolButtons).forEach(b => b.classList.remove("active"));
  toolButtons[t].classList.add("active");
}

/* =====================================================
   POINTER EVENTS
===================================================== */
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  isDrawing = true;

  const p = getPoint(e);

  if (tool === "brush" || tool === "eraser") {
    livePoints = [p];
  } else {
    shapePreview = {
      type: "shape",
      shape: tool,
      start: p,
      end: p,
      color: currentColor,
      size: brushWidth
    };
  }
});

canvas.addEventListener("pointermove", e => {
  if (!isDrawing) return;
  const p = getPoint(e);

  if (tool === "brush" || tool === "eraser") {
    livePoints.push(p);
    redrawCanvas();          // redraw committed strokes
    drawLiveSmoothStroke(); // draw current stroke smoothly
  } else {
    shapePreview.end = p;
    redrawCanvas();
    drawShape(shapePreview);
  }

  socket.emit("cursor:move", p);
});

canvas.addEventListener("pointerup", () => {
  if (!isDrawing) return;
  isDrawing = false;

  if (tool === "brush" || tool === "eraser") {
    const stroke = {
      id: crypto.randomUUID(),
      type: "free",
      points: livePoints,
      color: currentColor,
      size: tool === "eraser" ? brushWidth * 2 : brushWidth,
      tool
    };

    // ✅ OPTIMISTIC LOCAL COMMIT (THE FIX)
    operations.push({ stroke, active: true });
    redrawCanvas();

    // server commit (authoritative)
    socket.emit("stroke:commit", stroke);

    livePoints = [];
  } else if (shapePreview) {
    socket.emit("stroke:commit", {
      id: crypto.randomUUID(),
      ...shapePreview
    });
    shapePreview = null;
  }
});


/* =====================================================
   LIVE SMOOTH DRAWING (FIX)
===================================================== */
function drawLiveSmoothStroke() {
  if (livePoints.length < 2) return;

  ctx.save();
  ctx.lineWidth = tool === "eraser" ? brushWidth * 2 : brushWidth;
  ctx.strokeStyle = currentColor;
  ctx.globalCompositeOperation =
    tool === "eraser" ? "destination-out" : "source-over";

  ctx.beginPath();
  ctx.moveTo(livePoints[0].x, livePoints[0].y);

  for (let i = 1; i < livePoints.length - 1; i++) {
    const midX = (livePoints[i].x + livePoints[i + 1].x) / 2;
    const midY = (livePoints[i].y + livePoints[i + 1].y) / 2;
    ctx.quadraticCurveTo(livePoints[i].x, livePoints[i].y, midX, midY);
  }

  ctx.lineTo(
    livePoints.at(-1).x,
    livePoints.at(-1).y
  );

  ctx.stroke();
  ctx.restore();
}

/* =====================================================
   SHAPES
===================================================== */
function drawShape(s) {
  ctx.save();
  ctx.lineWidth = s.size;
  ctx.strokeStyle = s.color;

  switch (s.shape) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(s.start.x, s.start.y);
      ctx.lineTo(s.end.x, s.end.y);
      ctx.stroke();
      break;
    case "rect":
      ctx.strokeRect(
        s.start.x,
        s.start.y,
        s.end.x - s.start.x,
        s.end.y - s.start.y
      );
      break;
    case "circle":
      const r = Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
      ctx.beginPath();
      ctx.arc(s.start.x, s.start.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(s.start.x, s.end.y);
      ctx.lineTo((s.start.x + s.end.x) / 2, s.start.y);
      ctx.lineTo(s.end.x, s.end.y);
      ctx.closePath();
      ctx.stroke();
      break;
  }

  ctx.restore();
}

/* =====================================================
   REDRAW (AUTHORITATIVE)
===================================================== */
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  operations.forEach(op => {
    if (!op.active) return;

    if (op.stroke.type === "free") {
      drawFinalFreeStroke(op.stroke);
    } else if (op.stroke.type === "shape") {
      drawShape(op.stroke);
    }
  });
}

function drawFinalFreeStroke(stroke) {
  ctx.save();
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.color;
  ctx.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";

  const pts = stroke.points;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }

  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
  ctx.stroke();
  ctx.restore();
}

/* =====================================================
   RESIZE
===================================================== */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  redrawCanvas();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* =====================================================
   UTILS
===================================================== */
function getPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
