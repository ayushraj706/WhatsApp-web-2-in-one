const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Message model = the "Shadow Backup" store.
 * Every inbound/outbound WA message is persisted the instant it arrives,
 * BEFORE any revoke/delete event can touch it. This is what powers Anti-Delete.
 */
const Message = sequelize.define("Message", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  waMessageId: { type: DataTypes.STRING, allowNull: false, unique: true },
  chatId: { type: DataTypes.STRING, allowNull: false, index: true },
  userId: { type: DataTypes.UUID, allowNull: false }, // owner of the WA session
  sender: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM("text", "image", "video", "audio", "document", "sticker"), defaultValue: "text" },
  content: { type: DataTypes.TEXT },        // caption / text body
  mediaUrl: { type: DataTypes.STRING },     // S3/local path if media
  timestamp: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM("sent", "delivered", "read"), defaultValue: "sent" },

  // --- Anti-Delete fields ---
  isDeletedBySender: { type: DataTypes.BOOLEAN, defaultValue: false }, // sender revoked it
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "messages",
  timestamps: true,
  indexes: [{ fields: ["chatId", "timestamp"] }],
});

module.exports = Message;
