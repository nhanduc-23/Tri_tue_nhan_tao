const API_URL = "";
const SEND_INTERVAL_MS = 600;
const MAX_FRAME_SIDE = 640;
const BIN_COLORS = { yellow: "#f2ca28", green: "#31945b", gray: "#737b80", orange: "#ed8733", blue: "#3478c7", red: "#ca4545" };

const video = document.querySelector("#video");
const snapshot = document.querySelector("#snapshot");
const photoInput = document.querySelector("#photo-input");
const photoButton = document.querySelector("#photo-button");
const installButton = document.querySelector("#install-button");
const canvas = document.querySelector("#overlay");
const context = canvas.getContext("2d");
const statusText = document.querySelector("#status");
const serverStatusText = document.querySelector("#server-status");
const statsBody = document.querySelector("#stats");
const statsTotal = document.querySelector("#stats-total");
const instructionsList = document.querySelector("#instructions");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const clearStatsButton = document.querySelector("#clear-stats");
const exportCsvButton = document.querySelector("#export-csv");
const confidenceInput = document.querySelector("#confidence-threshold");
const confidenceValue = document.querySelector("#confidence-value");
let stream = null;
let timer = null;
let requestInProgress = false;
const totals = new Map();
const classMetadata = new Map();
const lastFrameCounts = new Map();
const lastCountedAt = new Map();
const countHistory = [];
let lastDetections = [];
let lastImageWidth = 0;
let lastImageHeight = 0;
let snapshotUrl = null;
let serverModeLabel = "";
let lastInferenceMs = null;

function renderServerStatus() {
  if (!serverModeLabel) return;
  const latency = lastInferenceMs === null ? "Chưa có lượt nhận diện" : `Inference: ${lastInferenceMs} ms`;
  serverStatusText.textContent = `Chế độ: ${serverModeLabel} · ${latency}`;
}

async function loadServerHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error("Health request failed");
    const health = await response.json();
    serverModeLabel = health.mode === "mock" ? "dữ liệu giả" : "model thật";
    renderServerStatus();
  } catch (_error) {
    serverModeLabel = "";
    serverStatusText.textContent = "Không kết nối được máy chủ";
  }
}

function visibleDetections(detections) {
  const threshold = Number(confidenceInput.value);
  return detections.filter((item) => Number(item.confidence) >= threshold);
}

function activeMedia() {
  return snapshot && !snapshot.hidden ? snapshot : video;
}

function resizeOverlay() {
  const media = activeMedia();
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  drawDetections(lastDetections, lastImageWidth, lastImageHeight);
}

function drawDetections(detections, imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) return;
  const media = activeMedia();
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const scaleX = (rect.width * dpr) / imageWidth;
  const scaleY = (rect.height * dpr) / imageHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = Math.max(2, rect.width / 300) * dpr;
  context.font = `${Math.max(14, rect.width / 35) * dpr}px system-ui`;
  detections.forEach((item) => {
    if (!Array.isArray(item.bbox) || item.bbox.length !== 4) return;
    const [x1, y1, x2, y2] = item.bbox;
    const x = x1 * scaleX;
    const y = y1 * scaleY;
    const width = (x2 - x1) * scaleX;
    const height = (y2 - y1) * scaleY;
    context.strokeStyle = "#75f0a7";
    context.strokeRect(x, y, width, height);
    const label = `${item.class_vi || item.class} ${Math.round((item.confidence || 0) * 100)}%`;
    const textWidth = context.measureText(label).width;
    const labelY = Math.max(0, y - 26);
    context.fillStyle = "#176b52";
    context.fillRect(x, labelY, textWidth + 12 * dpr, 26 * dpr);
    context.fillStyle = "white";
    context.fillText(label, x + 6 * dpr, Math.max(18 * dpr, labelY + 19 * dpr));
  });
}

function countCurrentFrame(detections) {
  const frameCounts = new Map();
  const detectionsByClass = new Map();
  detections.forEach((detection) => {
    const className = detection.class || "unknown";
    frameCounts.set(className, (frameCounts.get(className) || 0) + 1);
    if (!detectionsByClass.has(className)) detectionsByClass.set(className, []);
    detectionsByClass.get(className).push(detection);
    classMetadata.set(className, detection);
  });

  const now = Date.now();
  frameCounts.forEach((count, className) => {
    const previousCount = lastFrameCounts.get(className) || 0;
    const increase = Math.max(0, count - previousCount);
    const cooldownPassed = now - (lastCountedAt.get(className) || 0) >= 3000;
    // Chosen rule: count newly increased same-class objects immediately; when the
    // frame count is steady, count at most one again per label every three seconds.
    const added = increase > 0 ? increase : (cooldownPassed ? 1 : 0);
    if (!added) return;

    const candidates = detectionsByClass.get(className);
    const countedDetections = increase > 0
      ? candidates.slice(previousCount, previousCount + added)
      : [candidates.reduce((best, item) => item.confidence > best.confidence ? item : best)];
    totals.set(className, (totals.get(className) || 0) + added);
    lastCountedAt.set(className, now);
    countedDetections.forEach((detection) => {
      countHistory.push({ timestamp: new Date(now).toISOString(), ...detection });
    });
    if (countHistory.length > 1000) countHistory.splice(0, countHistory.length - 1000);
  });

  lastFrameCounts.clear();
  frameCounts.forEach((count, className) => lastFrameCounts.set(className, count));
}

function renderSummary(detections) {
  statsBody.replaceChildren();
  let totalCount = 0;
  if (!totals.size) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Chưa có dữ liệu";
    row.append(cell);
    statsBody.append(row);
  } else {
    totals.forEach((count, className) => {
      totalCount += count;
      const metadata = classMetadata.get(className) || {};
      const row = document.createElement("tr");
      const name = document.createElement("td");
      const quantity = document.createElement("td");
      const bin = document.createElement("td");
      name.textContent = metadata.class_vi || className;
      quantity.textContent = String(count);
      const swatch = document.createElement("span");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = BIN_COLORS[metadata.bin_color] || metadata.bin_color || "#737b80";
      swatch.setAttribute("aria-label", `Màu thùng ${metadata.bin_color || "chưa rõ"}`);
      bin.append(swatch, document.createTextNode(metadata.bin_color || "chưa rõ"));
      row.append(name, quantity, bin);
      statsBody.append(row);
    });
  }
  statsTotal.textContent = String(totalCount);

  instructionsList.replaceChildren();
  if (!detections.length) {
    const item = document.createElement("li");
    item.textContent = "Không phát hiện vật thể trong khung hình này.";
    instructionsList.append(item);
  } else {
    detections.forEach((detection) => {
      const item = document.createElement("li");
      item.style.setProperty("--bin-color", BIN_COLORS[detection.bin_color] || detection.bin_color || "#737b80");
      const label = document.createElement("span");
      label.className = "bin-label";
      label.textContent = `${detection.class_vi || detection.class} · thùng ${detection.bin_color || "chưa rõ"}: `;
      const instruction = document.createElement("span");
      instruction.textContent = detection.instruction || "Làm theo hướng dẫn phân loại tại địa phương.";
      item.append(label, instruction);
      instructionsList.append(item);
    });
  }
}

function updateSummary(detections) {
  countCurrentFrame(detections);
  renderSummary(detections);
}

async function sendFrame() {
  if (requestInProgress || !video.videoWidth || !stream) return;
  requestInProgress = true;
  try {
    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const frame = document.createElement("canvas");
    frame.width = Math.max(1, Math.round(video.videoWidth * scale));
    frame.height = Math.max(1, Math.round(video.videoHeight * scale));
    frame.getContext("2d").drawImage(video, 0, 0, frame.width, frame.height);
    const blob = await new Promise((resolve) => frame.toBlob(resolve, "image/jpeg", 0.7));
    if (!blob) throw new Error("Không tạo được ảnh từ camera.");
    await submitImage(blob, "frame.jpg");
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    requestInProgress = false;
  }
}

async function submitImage(blob, filename) {
  const form = new FormData();
  form.append("file", blob, filename);
  let response;
  try {
    response = await fetch(`${API_URL}/detect`, { method: "POST", body: form });
  } catch (_error) {
    throw new Error("Backend không phản hồi. Kiểm tra kết nối tunnel và thử lại.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 400) throw new Error("Ảnh gửi lên không hợp lệ. Hãy chọn JPEG hoặc PNG.");
    if (response.status === 413) throw new Error("Ảnh vượt quá giới hạn 5 MB.");
    throw new Error(result.error === "inference_failed" ? "Bộ nhận diện đang gặp sự cố." : `Backend trả về HTTP ${response.status}.`);
  }
  lastDetections = visibleDetections(Array.isArray(result.detections) ? result.detections : []);
  lastImageWidth = result.image_width;
  lastImageHeight = result.image_height;
  resizeOverlay();
  updateSummary(lastDetections);
  lastInferenceMs = result.inference_ms;
  renderServerStatus();
  statusText.textContent = `${lastDetections.length} vật thể · ${result.inference_ms} ms.`;
}

async function handlePhoto(file) {
  if (!file) return;
  if (requestInProgress) return;
  requestInProgress = true;
  try {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    snapshotUrl = URL.createObjectURL(file);
    snapshot.src = snapshotUrl;
    snapshot.hidden = false;
    video.hidden = true;
    await snapshot.decode();
    resizeOverlay();
    await submitImage(file, file.name || "photo.jpg");
  } catch (error) {
    statusText.textContent = error.message || "Không đọc được ảnh đã chụp.";
  } finally {
    requestInProgress = false;
    photoInput.value = "";
  }
}

async function startCamera() {
  if (!window.isSecureContext) {
    statusText.textContent = "Camera điện thoại chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở link HTTPS của tunnel.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "Trình duyệt này không hỗ trợ camera. Hãy dùng nút Chụp 1 ảnh.";
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = stream;
    await video.play();
    video.hidden = false;
    snapshot.hidden = true;
    resizeOverlay();
    startButton.disabled = true;
    stopButton.disabled = false;
    statusText.textContent = "Camera đã bật; đang nhận diện.";
    timer = window.setInterval(sendFrame, SEND_INTERVAL_MS);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    statusText.textContent = error.name === "NotAllowedError" || error.name === "PermissionDeniedError"
      ? "Bạn chưa cấp quyền camera. Hãy cho phép camera trong trình duyệt rồi thử lại."
      : "Không mở được camera. Kiểm tra thiết bị, quyền truy cập và dùng localhost hoặc HTTPS.";
  }
}

function stopCamera() {
  window.clearInterval(timer);
  timer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  lastDetections = [];
  startButton.disabled = false;
  stopButton.disabled = true;
  statusText.textContent = "Camera đã dừng.";
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
photoButton.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", () => handlePhoto(photoInput.files?.[0]));
window.addEventListener("resize", resizeOverlay);
window.addEventListener("orientationchange", () => window.setTimeout(resizeOverlay, 150));
video.addEventListener("loadedmetadata", resizeOverlay);
snapshot.addEventListener("load", resizeOverlay);

// Offline support is optional; registration errors must not affect camera/API use.
(async () => {
  try {
    if (window.isSecureContext && "serviceWorker" in navigator) {
      await navigator.serviceWorker.register("sw.js");
    }
  } catch (error) {
    console.warn("Service worker registration failed:", error);
  }
})();

const standaloneMode = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null;
installButton.hidden = true;
if (!standaloneMode) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });
}

function csvCell(value) {
  const textValue = String(value ?? "");
  return `"${textValue.replaceAll('"', '""')}"`;
}

function exportStatsCsv() {
  const columns = ["thời gian", "class", "class_vi", "bin_group", "bin_color", "confidence"];
  const lines = [columns.map(csvCell).join(",")];
  countHistory.forEach((row) => {
    lines.push([
      row.timestamp,
      row.class,
      row.class_vi,
      row.bin_group,
      row.bin_color,
      row.confidence,
    ].map(csvCell).join(","));
  });

  const now = new Date();
  const twoDigits = (number) => String(number).padStart(2, "0");
  const filename = `waste-stats-${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}.csv`;
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearSessionStats() {
  totals.clear();
  classMetadata.clear();
  lastFrameCounts.clear();
  lastCountedAt.clear();
  countHistory.length = 0;
  renderSummary([]);
}

confidenceInput.addEventListener("input", () => {
  confidenceValue.textContent = Number(confidenceInput.value).toFixed(2);
});
clearStatsButton.addEventListener("click", clearSessionStats);
exportCsvButton.addEventListener("click", exportStatsCsv);
loadServerHealth();

