import { PrismaClient } from "@prisma/client";

export const db = globalThis.prisma || new PrismaClient();

if(process.env.NODE_ENV !== "production"){
    globalThis.prisma = db;
}

//globalThis.prisma : THis global variable ensure that the prisma client instance is reused across hot reloads during development.Without this each time your application realoads a new intance of the prisma client would be created,potentially leading to connection issues 