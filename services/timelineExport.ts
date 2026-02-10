import { VideoClip } from "../types";

interface TimelineClip {
  id: string;
  videoClip: VideoClip;
  startTime: number;
  duration: number;
  track: "a-roll" | "b-roll";
}

export async function exportTimeline(
  timeline: TimelineClip[],
  onProgress?: (progress: number) => void
): Promise<string> {
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const FPS = 30;

  // Sort clips by start time
  const sortedTimeline = [...timeline].sort((a, b) => a.startTime - b.startTime);

  // Calculate total duration
  const totalDuration = Math.max(
    ...sortedTimeline.map((c) => c.startTime + c.duration)
  );

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create canvas context");

  // Setup MediaRecorder
  const stream = canvas.captureStream(FPS);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: "video/webm; codecs=vp9",
    videoBitsPerSecond: 25_000_000,
  });

  const chunks: BlobPart[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start();

  // Get A-roll clip
  const aRollClip = sortedTimeline.find((c) => c.track === "a-roll");
  if (!aRollClip) throw new Error("No A-roll found");

  // Load A-roll video
  const aRollVideo = document.createElement("video");
  aRollVideo.src = aRollClip.videoClip.url;
  aRollVideo.muted = true;
  aRollVideo.crossOrigin = "anonymous";

  await new Promise((resolve) => {
    aRollVideo.onloadeddata = resolve;
  });

  // Preload all B-roll videos
  const bRollVideos = new Map<string, HTMLVideoElement>();
  const bRollClips = sortedTimeline.filter((c) => c.track === "b-roll");

  for (const clip of bRollClips) {
    const video = document.createElement("video");
    video.src = clip.videoClip.url;
    video.muted = true;
    video.crossOrigin = "anonymous";
    await new Promise((resolve) => {
      video.onloadeddata = resolve;
    });
    bRollVideos.set(clip.id, video);
  }

  // Start A-roll playback
  await aRollVideo.play();

  let currentTime = 0;
  const frameDuration = 1 / FPS;

  // Render loop
  const render = () => {
    return new Promise<void>((resolve) => {
      const renderFrame = () => {
        if (currentTime >= totalDuration) {
          resolve();
          return;
        }

        // Update progress
        if (onProgress) {
          onProgress(Math.round((currentTime / totalDuration) * 100));
        }

        // Clear canvas
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Find active B-roll at current time
        const activeBRoll = bRollClips.find(
          (clip) =>
            currentTime >= clip.startTime &&
            currentTime < clip.startTime + clip.duration
        );

        if (activeBRoll) {
          // Show B-roll
          const bRollVideo = bRollVideos.get(activeBRoll.id);
          if (bRollVideo) {
            const bRollTime = currentTime - activeBRoll.startTime;
            bRollVideo.currentTime = bRollTime;

            drawVideoToCanvas(ctx, bRollVideo, CANVAS_WIDTH, CANVAS_HEIGHT);
          }
        } else {
          // Show A-roll
          aRollVideo.currentTime = currentTime;
          drawVideoToCanvas(ctx, aRollVideo, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        currentTime += frameDuration;
        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    });
  };

  await render();

  // Stop recording
  mediaRecorder.stop();

  await new Promise<void>((resolve) => {
    mediaRecorder.onstop = () => resolve();
  });

  // Create blob URL
  const blob = new Blob(chunks, { type: "video/webm" });
  return URL.createObjectURL(blob);
}

function drawVideoToCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number
) {
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  if (vW === 0 || vH === 0) return;

  const vRatio = vW / vH;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawW, drawH, offsetX, offsetY;

  if (vRatio > canvasRatio) {
    // Video is wider - fit width
    drawW = canvasWidth;
    drawH = canvasWidth / vRatio;
    offsetX = 0;
    offsetY = (canvasHeight - drawH) / 2;
  } else {
    // Video is taller - fit height
    drawH = canvasHeight;
    drawW = canvasHeight * vRatio;
    offsetX = (canvasWidth - drawW) / 2;
    offsetY = 0;
  }

  ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
}