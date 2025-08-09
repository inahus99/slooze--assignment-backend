import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
// import { authRequired, requireRole, countryScope } from "./rbac.js";
import { authRequired, requireRole, countryScope } from "./rbac";
dotenv.config();
const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res)=> res.json({ ok: true, service: "foodapp-api" }));

// -------- Auth --------
app.post("/auth/login",
  body("email").isEmail(),
  body("password").isString().isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, role: user.role, country: user.country, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.json({ token });
  }
);

// -------- Me --------
app.get("/me", authRequired, async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: (req as any).user.id }, select: { id: true, name: true, email: true, role: true, country: true, paymentMethod: true } });
  res.json(me);
});

// -------- Restaurants / Menu --------
app.get("/restaurants", authRequired, countryScope, async (req, res) => {
  const ctry = (req as any).countryScope;
  const restaurants = await prisma.restaurant.findMany({ where: ctry ? { country: ctry } : {}, include: { menuItems: true } });
  res.json(restaurants);
});

app.get("/restaurants/:id/menu", authRequired, countryScope, async (req, res) => {
  const id = Number(req.params.id);
  const ctry = (req as any).countryScope;
  const r = await prisma.restaurant.findFirst({ where: { id, ...(ctry ? { country: ctry } : {}) }, include: { menuItems: true } });
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r.menuItems);
});

// -------- Orders --------
// Create order
app.post("/orders",
  authRequired,
  body("items").isArray({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = (req as any).user;
    const items = req.body.items as { menuItemId: number, quantity: number }[];
    // fetch items
    const menuIds = items.map(i=>i.menuItemId);
    const menuRows = await prisma.menuItem.findMany({ where: { id: { in: menuIds } }, include: { restaurant: true } });
    if (menuRows.length !== items.length) return res.status(400).json({ error: "Invalid menu items" });
    // Country rule: non-admins can only order from their country
    if (user.role !== "ADMIN" && menuRows.some(m => m.restaurant.country !== user.country)) {
      return res.status(403).json({ error: "Cross-country order not allowed" });
    }
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        country: user.country,
        items: {
          create: items.map(it => {
            const row = menuRows.find(m=>m.id === it.menuItemId)!;
            return { menuItemId: it.menuItemId, quantity: it.quantity, priceEach: row.price };
          })
        }
      },
      include: { items: true }
    });
    // update total
    const total = order.items.reduce((s, it)=> s + it.priceEach * it.quantity, 0);
    await prisma.order.update({ where: { id: order.id }, data: { totalCents: total } });
    const fresh = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { include: { menuItem: true } } } });
    res.status(201).json(fresh);
  }
);

// My orders (scoped)
app.get("/orders/my", authRequired, async (req, res) => {
  const user = (req as any).user;
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { menuItem: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(orders);
});

// Checkout (place order) -> only ADMIN & MANAGER
app.post("/orders/:id/checkout", authRequired, requireRole("ADMIN","MANAGER"), async (req, res) => {
  const id = Number(req.params.id);
  const user = (req as any).user;
  const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
  if (!order) return res.status(404).json({ error: "Not found" });
  // Managers can only act within their country & on their own orders for simplicity
  if (user.role !== "ADMIN" && order.userId !== user.id) {
    return res.status(403).json({ error: "Managers can only checkout their own orders" });
  }
  if (user.role !== "ADMIN" && order.country !== user.country) {
    return res.status(403).json({ error: "Cross-country not allowed" });
  }
  if (order.status !== "CREATED") return res.status(400).json({ error: "Order not in CREATED state" });
  // Mock payment success
  const updated = await prisma.order.update({ where: { id }, data: { status: "PAID" } });
  res.json(updated);
});

// Cancel -> only ADMIN & MANAGER (same scoping rules as checkout)
app.post("/orders/:id/cancel", authRequired, requireRole("ADMIN","MANAGER"), async (req, res) => {
  const id = Number(req.params.id);
  const user = (req as any).user;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Not found" });
  if (user.role !== "ADMIN" && order.userId !== user.id) {
    return res.status(403).json({ error: "Managers can only cancel their own orders" });
  }
  if (user.role !== "ADMIN" && order.country !== user.country) {
    return res.status(403).json({ error: "Cross-country not allowed" });
  }
  if (order.status === "CANCELLED") return res.status(400).json({ error: "Already cancelled" });
  const updated = await prisma.order.update({ where: { id }, data: { status: "CANCELLED" } });
  res.json(updated);
});
//delete orders for admin only
app.delete("/orders/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    // remove children first to satisfy FK constraints
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    const deleted = await prisma.order.delete({ where: { id } });
    return res.json({ ok: true, id: deleted.id });
  } catch (e:any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" }); // Prisma record not found
    console.error("DELETE /orders/:id failed:", e);
    return res.status(500).json({ error: "Internal error" });
  }
});
// Update payment method -> ADMIN only (can update self or any user; here we implement self for simplicity)
app.patch("/me/payment-method", authRequired, requireRole("ADMIN"), body("paymentMethod").isString().isLength({min:3}), async (req, res) => {
  const user = (req as any).user;
  const updated = await prisma.user.update({ where: { id: user.id }, data: { paymentMethod: req.body.paymentMethod } });
  res.json({ id: updated.id, paymentMethod: updated.paymentMethod });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, ()=>{
  console.log(`API listening on http://localhost:${port}`);
});
