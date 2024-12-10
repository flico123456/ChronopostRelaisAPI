// Connexion à la base de données

const mysql = require('mysql');

const connection = mysql.createConnection({
  host: '51.222.13.7',
  port: '3306',
  user: 'ruben',
  password: 'Ruben@123',
  database: 'maillot_soraya_stock'
});

connection.connect((err) => {
  if (err) {
    console.error('Une erreur de co à la base de donnée', err.stack);
    return;
  }
  console.log('Connecté à la base de données');
});

module.exports = connection;
