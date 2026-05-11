const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const check = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({ role: String, nom: String }));
  const users = await User.find({});
  console.log("Users found:", users.length);
  users.forEach(u => console.log(`- ${u.nom || 'Sans nom'} (${u.role})`));
  process.exit(0);
};
check();
