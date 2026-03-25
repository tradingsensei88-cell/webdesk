const { PrismaClient } = require("@prisma/client");

async function main() {
    console.log("Checking PrismaClient initialization...");
    try {
        const prisma = new PrismaClient();
        console.log("Prisma initialized successfully using standard engine.");
        await prisma.$disconnect();
    } catch (e) {
        console.error("Prisma initialization failed:");
        console.error(e.message);
        console.error(JSON.stringify(e, null, 2));
    }
}

main();
