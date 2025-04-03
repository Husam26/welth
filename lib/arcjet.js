import arcjet, { tokenBucket } from "@arcjet/next";

const aj = arcjet({
    key: process.env.ARCJET_KEY,
    characteristics: ["userId"], // Track based on Clerk userId
    rules: [
        tokenBucket({
            mode: "LIVE",
            refillRate: 2, // Must be a number, not a string
            interval: 3600, // In seconds (3600 seconds = 1 hour)
            capacity: 10
        })
    ]
});

export default aj;
