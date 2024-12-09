const express = require('express');
const cors = require('cors');
const db = require('./database');
const http = require('http'); // Remplacer https par http
const fs = require('fs');

const app = express();
const port = 3001; // Port de votre serveur proxy

// Middleware pour autoriser les requêtes CORS depuis votre domaine
app.use(cors());

// Middleware pour parser le JSON dans les requêtes POST et PUT
app.use(express.json());

// Création du serveur HTTP
const httpServer = http.createServer(app);


//////////DEPOTS//////////

// INSERT
app.post('/depots/create', (req, res) => {
  const { name, localisation, username_associe } = req.body;

  // Vérifie que les champs obligatoires sont présents
  if (!name || !localisation) {
    return res.status(400).send('Le nom et la localisation sont requis');
  }

  // Prépare la requête SQL
  const query = 'INSERT INTO depots (name, localisation, username_associe) VALUES (?, ?, ?)';
  
  // Insère NULL si username_associe n'est pas fourni
  db.query(
    query,
    [name, localisation, username_associe || null],
    (err, result) => {
      if (err) {
        res.status(500).json({
          error: 'Erreur lors de l\'insertion',
          details: err.message,
        });
      } else {
        res.status(200).json({
          message: 'Valeur insérée',
          id: result.insertId,
        });
      }
    }
  );
});

// SELECT
app.get('/depots/select', (req, res) => {
  db.query('SELECT * FROM depots', (err, rows) => {
    if (err) {
      res.status(500).send('Erreur détails : ' + err.message);
    } else {
      res.status(200).json(rows);
    }
  });
});

// DELETE avec authentification
app.delete('/depots/delete/:id', (req, res) => {
  const id = req.params.id;
  const query = 'DELETE FROM depots WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      res.status(500).json('Erreur détails : ' + err.message);
    } else {
      res.status(200).json(`Valeur supprimée`);
    }
  });
});

// UPDATE avec authentification
app.put('/depots/update/:id', (req, res) => {
  const id = req.params.id;
  const { name, localisation } = req.body;
  if (!name) {
    return res.status(400).send('Le nom est requis');
  }

  const query = 'UPDATE depots SET name = ?, localisation = ? WHERE id = ?';
  db.query(query, [name, localisation, id], (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Erreur lors de l\'insertion', details: err.message });
    } else {
      res.status(200).json({ message: 'Valeur modifié', id: result.insertId });
    }
  });
});

////////////////////STOCKS////////////////////

// INSERT
app.post('/stock_by_depot/create', (req, res) => {
  const { depot_id, stock } = req.body;
  if (!depot_id || !stock) {
      return res.status(400).send('Depot ID et stock sont requis');
  }
  // Insérer le stock dans la base de données
  const query = 'INSERT INTO stock_by_depot (depot_id, stock) VALUES (?, ?)';
  db.query(query, [depot_id, JSON.stringify(stock)], (err, result) => {
      if (err) {
          return res.status(500).json({ error: 'Erreur lors de l\'insertion', details: err.message });
      }
      res.status(200).json({ message: 'Valeur insérée', id: result.insertId });
  });
});

app.get('/stock_by_depot/select/:id', (req, res) => {
  const id = req.params.id;
  const query = 'SELECT * FROM stock_by_depot WHERE depot_id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      res.status(500).send('Erreur détails : ' + err.message);
    } else if (result.length === 0) {
      res.status(404).send('Aucun stock trouvé pour ce dépôt');
    } else {
      res.status(200).json(result);
    }
  });
});

// UPDATE QUANTITY OR ADD PRODUCT IF NOT EXISTS
app.put('/stock_by_depot/update/:depot_id', (req, res) => {
  const depotId = req.params.depot_id;
  const { sku, quantite, nom_produit } = req.body;

  if (!sku || quantite === undefined || quantite === null || !nom_produit) {
    return res.status(400).send('SKU, quantité et nom_produit sont requis');
  }

  // Vérifier si le dépôt existe
  const selectDepotQuery = 'SELECT stock FROM stock_by_depot WHERE depot_id = ?';
  db.query(selectDepotQuery, [depotId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la vérification du dépôt', details: err.message });
    }

    let stock = [];

    // Si le dépôt n'existe pas, créer une ligne pour ce dépôt avec un stock vide
    if (result.length === 0) {
      const createDepotQuery = 'INSERT INTO stock_by_depot (depot_id, stock) VALUES (?, ?)';
      db.query(createDepotQuery, [depotId, JSON.stringify(stock)], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur lors de la création du dépôt', details: err.message });
        }

        // Après la création, continuer avec la mise à jour du stock
        updateStock(depotId, sku, quantite, nom_produit, stock, res);
      });
    } else {
      // Si le dépôt existe, récupérer son stock existant
      if (result[0].stock) {
        stock = JSON.parse(result[0].stock);
      }

      // Continuer avec la mise à jour du stock
      updateStock(depotId, sku, quantite, nom_produit, stock, res);
    }
  });

  function updateStock(depotId, sku, quantite, nom_produit, stock, res) {
    let productFound = false;

    // Mettre à jour la quantité du produit si le SKU existe déjà
    stock = stock.map((item) => {
      if (item.sku === sku) {
        item.quantite += quantite;
        productFound = true;
      }
      return item;
    });

    // Si le produit n'est pas trouvé, l'ajouter au stock
    if (!productFound) {
      stock.push({
        nom_produit: nom_produit,
        sku: sku,
        quantite: quantite,
      });
    }

    // Mettre à jour le stock dans la base de données
    const updateQuery = 'UPDATE stock_by_depot SET stock = ? WHERE depot_id = ?';
    db.query(updateQuery, [JSON.stringify(stock), depotId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du stock', details: err.message });
      }

      res.status(200).json({ message: 'Stock mis à jour avec succès', stock });
    });
  }
});



//////////LOGS//////////


// INSERT
app.post('/logs/create', (req, res) => {
  const { action_log, nom_log, depot_id, contenu_log } = req.body;
  
  // Vérifier que les champs requis sont présents
  if (!action_log, !nom_log || !depot_id || !contenu_log) {
    return res.status(400).send('action_log, nom_log, depot_id et contenu_log sont requis');
  }

  // Insérer le log dans la base de données
  const query = 'INSERT INTO logs (action_log, nom_log, depot_id, contenu_log) VALUES (?, ?, ?, ?)';
  db.query(query, [action_log, nom_log, depot_id, JSON.stringify(contenu_log)], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de l\'insertion', details: err.message });
    }
    
    // Répondre avec succès et renvoyer l'ID de l'insertion
    res.status(200).json({ message: 'Valeur insérée', id: result.insertId });
  });
});


// SELECT Logs
app.get('/logs/select', (req, res) => {
  const { nom_log, depot_id } = req.query;

  // Construire la requête SQL de base
  let query = 'SELECT * FROM logs WHERE 1=1';
  const queryParams = [];

  // Ajouter des filtres optionnels
  if (nom_log) {
    query += ' AND nom_log = ?';
    queryParams.push(nom_log);
  }
  
  if (depot_id) {
    query += ' AND depot_id = ?';
    queryParams.push(depot_id);
  }

  // Exécuter la requête
  db.query(query, queryParams, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des logs', details: err.message });
    }

    // Retourner les résultats
    res.status(200).json(results);
  });
});


// Démarrer le serveur HTTP
httpServer.listen(port, () => {
  console.log(`Serveur proxy démarré sur le port ${port}`);
});
