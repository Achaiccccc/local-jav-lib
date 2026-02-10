const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ActorFromNfo = sequelize.define('ActorFromNfo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    }
  }, {
    tableName: 'actors_from_nfo',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return ActorFromNfo;
};
