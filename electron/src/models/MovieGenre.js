const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MovieGenre = sequelize.define('MovieGenre', {
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
    genre_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'genres',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'movie_genres',
    timestamps: false,
    indexes: [
      { fields: ['movie_id'] },
      { fields: ['genre_id'] },
      { unique: true, fields: ['movie_id', 'genre_id'] }
    ]
  });

  return MovieGenre;
};
