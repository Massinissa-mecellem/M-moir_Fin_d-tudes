const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Publication', publicationSchema);
