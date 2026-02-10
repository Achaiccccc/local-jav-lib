const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MovieActor = sequelize.define('MovieActor', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    movie_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'movies',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'actors',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'movie_actors',
    timestamps: false,
    indexes: [
      { fields: ['movie_id'] },
      { fields: ['actor_id'] },
      { unique: true, fields: ['movie_id', 'actor_id'] }
    ]
  });

  return MovieActor;
};
