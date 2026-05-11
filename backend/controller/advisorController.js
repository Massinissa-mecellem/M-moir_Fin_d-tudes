const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getConversations = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const user = await User.findById(userId);

    let query = {};
    if (user.role === 'conseiller') {
      query = { advisor: userId };
    } else {
      query = { farmer: userId };
    }

    const convs = await Conversation.find(query)
      .populate('farmer', 'nom prenom photo')
      .populate('advisor', 'nom prenom photo')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    return res.json(convs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 });
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, text, fileUrl, fileName, fileType } = req.body;
    const sender = req.auth.userId;

    const message = new Message({
      conversation: conversationId,
      sender,
      text,
      fileUrl,
      fileName,
      fileType
    });

    await message.save();

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: Date.now()
    });

    // Notify via socket
    req.io.to(conversationId).emit('message', message);

    return res.status(201).json(message);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.initiateConversation = async (req, res) => {
  try {
    const farmerId = req.auth.userId;
    const { advisorId } = req.body;

    let conv = await Conversation.findOne({ farmer: farmerId, advisor: advisorId });
    
    if (!conv) {
      conv = new Conversation({ farmer: farmerId, advisor: advisorId });
      await conv.save();
    }

    // On peuple pour que le frontend ait les noms et photos immédiatement
    const populatedConv = await Conversation.findById(conv._id)
      .populate('farmer', 'nom prenom photo')
      .populate('advisor', 'nom prenom photo')
      .populate('lastMessage');

    return res.status(201).json(populatedConv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getAllAdvisors = async (req, res) => {
  try {
    const advisors = await User.find({ role: 'conseiller' })
      .select('nom prenom email photo telephone adresse specialites wilaya');
    return res.json(advisors);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
