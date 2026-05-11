const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  advisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Ensure unique conversation between same farmer and advisor
conversationSchema.index({ farmer: 1, advisor: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
