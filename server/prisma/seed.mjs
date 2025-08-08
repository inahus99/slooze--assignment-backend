import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash("password123", 10);

  const users = [
    { name: "Nick Fury", email: "nick@slooze.xyz", passwordHash: pw, role: "ADMIN",  country: "INDIA",   paymentMethod: "VISA **** 1111" },
    { name: "Captain Marvel", email: "carol@slooze.xyz", passwordHash: pw, role: "MANAGER", country: "INDIA" },
    { name: "Captain America", email: "steve@slooze.xyz", passwordHash: pw, role: "MANAGER", country: "AMERICA" },
    { name: "Thanos", email: "thanos@slooze.xyz", passwordHash: pw, role: "MEMBER", country: "INDIA" },
    { name: "Thor", email: "thor@slooze.xyz", passwordHash: pw, role: "MEMBER", country: "INDIA" },
    { name: "Travis", email: "travis@slooze.xyz", passwordHash: pw, role: "MEMBER", country: "AMERICA" },
  ];

  // Use upsert instead of createMany+skipDuplicates (works on SQLite)
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  // Restaurants
  const rest1 = await prisma.restaurant.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Mumbai Masala", country: "INDIA" },
  });
  const rest2 = await prisma.restaurant.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Bangalore Bites", country: "INDIA" },
  });
  const rest3 = await prisma.restaurant.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "New York Nosh", country: "AMERICA" },
  });
  const rest4 = await prisma.restaurant.upsert({
    where: { id: 4 },
    update: {},
    create: { name: "San Francisco Sizzle", country: "AMERICA" },
  });

  // Menu items (idempotent-ish: ensure they exist)
  await prisma.menuItem.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Paneer Tikka", price: 500, restaurantId: rest1.id },
  });
  await prisma.menuItem.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Masala Dosa", price: 350, restaurantId: rest2.id },
  });
  await prisma.menuItem.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "Cheeseburger", price: 899, restaurantId: rest3.id },
  });
  await prisma.menuItem.upsert({
    where: { id: 4 },
    update: {},
    create: { name: "Sourdough Pizza", price: 1299, restaurantId: rest4.id },
  });

  console.log("Seed complete.");
}

main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
