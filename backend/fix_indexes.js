const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connecté à MongoDB");
    
    const User = mongoose.model('User', new mongoose.Schema({}));
    
    console.log("Suppression de l'index googleId_1...");
    try {
      await User.collection.dropIndex('googleId_1');
      console.log("Index supprimé avec succès.");
    } catch (e) {
      console.log("L'index googleId_1 n'existe pas ou a déjà été supprimé.");
    }

    console.log("Suppression de l'index googleId_1_sparse...");
    try {
      await User.collection.dropIndex('googleId_1_sparse');
    } catch (e) {}

    console.log("Index nettoyés. Relancez le serveur pour que Mongoose recrée les bons index (sparse).");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixIndexes();
