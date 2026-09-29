import { describe, expect, it } from "vitest";
import { isVideoFile, MAX_VIDEO_BYTES, videoMime, videoProblem } from "./video";

describe("videoProblem", () => {
  it("accepts videos up to 2:00", () => {
    expect(videoProblem(95, 200e6)).toBeNull();
    expect(videoProblem(120.4, 200e6)).toBeNull();
  });

  it("asks for a trim when the video is too long", () => {
    expect(videoProblem(192, 200e6)).toBe("That video is 3:12. Please trim it to 2:00 or less and try again.");
  });

  it("rejects files over 1 GB and unreadable durations", () => {
    expect(videoProblem(60, MAX_VIDEO_BYTES + 1)).toMatch(/over 1 GB/);
    expect(videoProblem(NaN, 1000)).toMatch(/couldn't read/);
  });
});

describe("videoMime", () => {
  it("uses the file type, or falls back to the extension", () => {
    expect(videoMime({ type: "video/mp4", name: "a.mp4" })).toBe("video/mp4");
    expect(videoMime({ type: "", name: "Question.MOV" })).toBe("video/quicktime");
    expect(videoMime({ type: "", name: "clip" })).toBe("video/mp4");
  });
});

describe("isVideoFile", () => {
  it("goes by type, then extension when the type is blank", () => {
    expect(isVideoFile({ type: "video/quicktime", name: "q.mov" })).toBe(true);
    expect(isVideoFile({ type: "", name: "q.MOV" })).toBe(true);
    expect(isVideoFile({ type: "audio/mp4", name: "memo.m4a" })).toBe(false);
    expect(isVideoFile({ type: "audio/webm", name: "note.webm" })).toBe(false);
    expect(isVideoFile({ type: "", name: "memo.mp3" })).toBe(false);
  });
});
