const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = sequelize.define("User", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: DataTypes.STRING,
  avatarUrl: DataTypes.STRING,
  oauthProvider: { type: DataTypes.ENUM("google", "github"), allowNull: false },
  oauthId: { type: DataTypes.STRING, allowNull: false },

  // AI Automation preferences
  aiEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  aiMode: { type: DataTypes.ENUM("manual", "automatic"), defaultValue: "manual" },
  aiSelectedModel: { type: DataTypes.STRING, defaultValue: "gpt-4o-mini" },
  aiSizePolicy: { type: DataTypes.ENUM("largest", "fastest", "auto"), defaultValue: "auto" },
  aiRequireConfirmation: { type: DataTypes.BOOLEAN, defaultValue: true },
  aiApiKeys: { type: DataTypes.JSONB, defaultValue: {} }, // encrypted at rest, see utils/crypto
}, { tableName: "users", timestamps: true });

module.exports = User;
