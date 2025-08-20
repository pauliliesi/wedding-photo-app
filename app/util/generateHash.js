// generateHash.js
const bcrypt = require('bcryptjs');

// The plain text password you want to use for admin login
const plainPassword = "xoiRPU$I$H6vI9&nKOUNx3d0"; // Or your preferred strong password

const saltRounds = 12; // Use a good number of salt rounds (10-12 is common)

const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

console.log(`Plain Password: ${plainPassword}`);
console.log(`Bcrypt Hash   : ${hashedPassword}`);
console.log("\n👆 Copy this Bcrypt Hash and update it in your Supabase admin_users table.");