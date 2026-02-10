const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MovieActorFromNfo = sequelize.define('MovieActorFromNfo', {
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
      }
    },
    actor_from_nfo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'actors_from_nfo',
        key: 'id'
      }
    }
  }, {
    tableName: 'movie_actors_from_nfo',
    timestamps: false,
    indexes: [
      { fields: ['movie_id'] },
      { fields: ['actor_from_nfo_id'] },
      { fields: ['movie_id', 'actor_from_nfo_id'], unique: true }
    ]
  });

  return MovieActorFromNfo;
};
