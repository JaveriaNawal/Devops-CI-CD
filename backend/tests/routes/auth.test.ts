import request from "supertest";
import app from "../../src/app";
import bcrypt from "bcryptjs";

// ── Mock DB ───────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock("../../src/db/connection", () => ({
  getPool: () => ({
    request: () => ({ input: jest.fn().mockReturnThis(), query: mockQuery }),
    connected: true,
  }),
}));

describe("POST /api/auth/login", () => {
  const validPassword = "securePass123";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(validPassword, 10);
  });

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  it("returns 401 when user not found", async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 401 when password is wrong", async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [{ id: 1, name: "Alice", email: "alice@example.com", password_hash: passwordHash }],
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "wrongPassword" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with token on success", async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [{ id: 1, name: "Alice", email: "alice@example.com", password_hash: passwordHash }],
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: validPassword });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("alice@example.com");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  it("returns 409 when email already exists", async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ id: 99 }] }); // duplicate check
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Bob", email: "bob@example.com", password: "securePass123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
  });

  it("returns 201 with token on successful registration", async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })             // no duplicate
      .mockResolvedValueOnce({ recordset: [{ id: 42 }] }); // INSERT result
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Charlie", email: "charlie@example.com", password: "securePass123" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.id).toBe(42);
  });
});
