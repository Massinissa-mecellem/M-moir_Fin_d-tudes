const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, select: false },
  nom: { type: String, default: '' },
  prenom: { type: String, default: '' },
  photo: { type: String, default: '' },
  role: {
    type: String,
    enum: ['agriculteur', 'conseiller', 'admin'],
    default: 'agriculteur',
  },
  wilaya: { type: String, default: '' },
  nomExploitation: { type: String, default: '' },
  telephone: { type: String, default: '' },
  adresse: { type: String, default: '' },
  specialites: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

// Assurer l'index unique et sparse sur googleId
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    throw err;
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
