const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function main() {
    console.log("Initializing standard PrismaClient...");
    const prisma = new PrismaClient({
        log: ["info", "query", "warn", "error"],
    });

    const email = `test-${Date.now()}@example.com`;
    const password = "password123";

    try {
        console.log("Connecting...");
        await prisma.$connect();

        console.log("Checking user count...");
        const count = await prisma.user.count();
        console.log("User count:", count);

        console.log("Creating user:", email);
        const user = await prisma.user.create({
            data: {
                email,
                password: "hash",
                name: "Test User",
                role: "student",
                credits: 30
            }
        });
        console.log("User created:", user.id);

    } catch (e) {
        console.error("Prisma Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
