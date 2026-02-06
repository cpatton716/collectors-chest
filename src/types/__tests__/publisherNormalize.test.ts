import { normalizePublisher } from "@/types/comic";

describe("normalizePublisher", () => {
  it("maps DC to DC Comics", () => {
    expect(normalizePublisher("DC")).toBe("DC Comics");
  });
  it("maps Marvel to Marvel Comics", () => {
    expect(normalizePublisher("Marvel")).toBe("Marvel Comics");
  });
  it("maps Image to Image Comics", () => {
    expect(normalizePublisher("Image")).toBe("Image Comics");
  });
  it("maps Dark Horse to Dark Horse Comics", () => {
    expect(normalizePublisher("Dark Horse")).toBe("Dark Horse Comics");
  });
  it("maps IDW to IDW Publishing", () => {
    expect(normalizePublisher("IDW")).toBe("IDW Publishing");
  });
  it("maps BOOM to Boom! Studios", () => {
    expect(normalizePublisher("BOOM")).toBe("Boom! Studios");
  });
  it("maps Boom to Boom! Studios", () => {
    expect(normalizePublisher("Boom")).toBe("Boom! Studios");
  });
  it("maps Dynamite to Dynamite Entertainment", () => {
    expect(normalizePublisher("Dynamite")).toBe("Dynamite Entertainment");
  });
  it("maps Valiant to Valiant Comics", () => {
    expect(normalizePublisher("Valiant")).toBe("Valiant Comics");
  });
  it("maps Archie to Archie Comics", () => {
    expect(normalizePublisher("Archie")).toBe("Archie Comics");
  });
  it("is case-insensitive", () => {
    expect(normalizePublisher("dc")).toBe("DC Comics");
    expect(normalizePublisher("MARVEL")).toBe("Marvel Comics");
  });
  it("passes through exact matches", () => {
    expect(normalizePublisher("DC Comics")).toBe("DC Comics");
    expect(normalizePublisher("Marvel Comics")).toBe("Marvel Comics");
  });
  it("returns null for unknown publishers", () => {
    expect(normalizePublisher("Unknown Press")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(normalizePublisher("")).toBeNull();
  });
  it("returns null for null", () => {
    expect(normalizePublisher(null)).toBeNull();
  });
});
