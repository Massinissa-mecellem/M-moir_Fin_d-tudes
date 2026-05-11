const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connecté à MongoDB...');

    const adminEmail = 'chebri.admin@gmail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('L\'administrateur existe déjà.');
      process.exit(0);
    }

    const admin = new User({
      email: adminEmail,
      password: '123456',
      nom: 'Admin',
      prenom: 'System',
      role: 'admin',
      nomExploitation: 'Administration Centrale'
    });

    await admin.save();
    console.log('Compte administrateur créé avec succès !');
    console.log('Email:', adminEmail);
    console.log('Password: (celui que vous avez fourni)');
    
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de la création de l\'admin:', err);
    process.exit(1);
  }
};

createAdmin();
