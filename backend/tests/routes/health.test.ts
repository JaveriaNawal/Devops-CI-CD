import request from "supertest";
import app from "../../src/app";

// ── Mock DB pool so tests don't need a real SQL server ────────
jest.mock("../../src/db/connection", () => ({
  getPool: () => ({
    request: () => ({
      query: jest.fn().mockResolvedValue({ recordset: [{ ping: 1 }] }),
    }),
    connected: true,
  }),
}));

describe("GET /api/health", () => {
  it("returns 200 with healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body.checks.database).toBe("ok");
  });

  it("returns correct content-type header", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});

describe("GET /api/health/ready", () => {
  it("returns 200 when DB is reachable", async () => {
    const res = await request(app).get("/api/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Route not found");
  });
});
