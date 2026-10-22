import { IMAGE_REMOTE_PATTERNS } from "../imageRemotePatterns.mjs";
import { isOptimizableImageSrc } from "../imageSrc";

describe("isOptimizableImageSrc", () => {
  it.each([
    "https://ytlzdczhzbyiujxwosez.supabase.co/storage/v1/object/public/comic-covers/a/b.webp",
    "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
    "https://img.clerk.com/eyJ0eXBlIjoicHJveHki",
    "https://covers.openlibrary.org/b/isbn/123-L.jpg",
    "https://comicvine.gamespot.com/a/uploads/scale_large/6/67663/123.jpg",
    "https://cdn.marvel.com/u/prod/marvel/i/mg/1/2/abc.jpg",
  ])("allows allowlisted host %s", (src) => {
    expect(isOptimizableImageSrc(src)).toBe(true);
  });

  it.each(["/icons/emblem.png", "/seller-onboarding/step-1.png"])(
    "allows relative path %s",
    (src) => {
      expect(isOptimizableImageSrc(src)).toBe(true);
    }
  );

  it.each([
    // Google Images thumbnail (Spider-Man 2099 #1 crash)
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR",
    "https://www.miragelicensing.com/tmnt/comics/issue-1",
    "https://www.google.com/aclk?sa=l&ai=DChcSEwi",
    // http (non-https) on an allowlisted host
    "http://i.ebayimg.com/images/g/abc/s-l1600.jpg",
    // allowlisted host, path outside the allowed pathname
    "https://ytlzdczhzbyiujxwosez.supabase.co/storage/v1/object/sign/x.jpg",
    "https://comicvine.gamespot.com/spider-man-2099-1/4000-123/",
    // lookalike host
    "https://i.ebayimg.com.evil.example/x.jpg",
    // protocol-relative
    "//i.ebayimg.com/images/g/abc.jpg",
    "data:image/png;base64,iVBORw0KGgo=",
    "blob:http://localhost:3000/1234",
    "not a url",
    "https://",
    "",
    "   ",
  ])("rejects %s", (src) => {
    expect(isOptimizableImageSrc(src)).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isOptimizableImageSrc(null)).toBe(false);
    expect(isOptimizableImageSrc(undefined)).toBe(false);
  });

  it("uses the same allowlist next.config.mjs imports (no wildcard host)", () => {
    expect(IMAGE_REMOTE_PATTERNS.length).toBeGreaterThan(0);
    for (const p of IMAGE_REMOTE_PATTERNS) {
      expect(p.protocol).toBe("https");
      expect(p.hostname).not.toBe("**");
      expect(p.hostname).not.toBe("*");
    }
  });
});
