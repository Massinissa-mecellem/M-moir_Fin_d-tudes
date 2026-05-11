const User = require('../models/User');
const Parcelle = require('../models/Parcel');

// Gestion des utilisateurs
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    
    // Optionnel: Supprimer les parcelles associées à l'utilisateur
    await Parcelle.deleteMany({ userId: req.params.id });
    
    res.json({ message: 'Utilisateur et ses données supprimés avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Supervision des quotas et statistiques
exports.getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalParcelles = await Parcelle.countDocuments();
    
    // Récupérer le nombre de conseillers vs agriculteurs
    const countByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Consommation par utilisateur (estimée par le nombre de parcelles)
    const consumptionByUser = await Parcelle.aggregate([
      { $group: { _id: '$userId', parcelCount: { $sum: 1 } } },
      { $sort: { parcelCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          email: '$userInfo.email',
          nom: '$userInfo.nom',
          prenom: '$userInfo.prenom',
          parcelCount: 1,
          estimatedRequests: { $multiply: ['$parcelCount', 15] }
        }
      }
    ]);

    res.json({
      totalUsers,
      totalParcelles,
      roles: countByRole,
      consumptionByUser,
      geeStats: {
        estimatedMonthlyRequests: totalParcelles * 15,
        quotaLimit: 10000,
        status: (totalParcelles * 15) > 8000 ? 'Warning' : 'Normal'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
