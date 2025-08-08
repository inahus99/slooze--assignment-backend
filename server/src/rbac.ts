import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type JWTPayload = { id: number; role: "ADMIN"|"MANAGER"|"MEMBER"; country: "INDIA"|"AMERICA"; email: string };

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET!) as JWTPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: JWTPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as JWTPayload | undefined;
    if (!user) return res.status(401).json({ error: "Auth required" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// Country scoping: non-admins can only access their country's data
export function countryScope(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JWTPayload | undefined;
  (req as any).countryScope = user?.role === "ADMIN" ? undefined : user?.country;
  next();
}
