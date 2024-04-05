// api/proxy.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const xml2js = require('xml2js');
const https = require('https');
const fs = require('fs');

const app = express();
const port = 3001; // Port de votre serveur proxy

// Middleware pour autoriser les requêtes CORS depuis votre domaine
app.use(cors());

// Options pour la configuration du serveur HTTPS
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/api.maillotsoraya-conception.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/api.maillotsoraya-conception.com/fullchain.pem')
};

// Création du serveur HTTPS
const httpsServer = https.createServer(options, app);

// Endpoint pour faire la requête à l'API Chronopost
app.get('/api/point-relais', async (req, res) => {
  try {
    const postalCode = req.query.postalCode
    const response = await axios.get('https://ws.chronopost.fr/recherchebt-ws-cxf/PointRelaisServiceWS/recherchePointChronopostInterParService', {
      params: {
        accountNumber: '44546801',
        password: '210011',
        zipCode: postalCode,
        countryCode: 'FR',
        type: 'P',
        productCode: '1',
        service: 'L',
        weight: '1000',
        shippingDate: '01/02/2018',
        maxPointChronopost: '5',
        maxDistanceSearch: '50',
        holidayTolerant: '1',
        language: 'FR'
      }
    });

    // Convertir la réponse XML en JSON
    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(response.data, (error, result) => {
      if (error) {
        console.error('Erreur lors de la conversion de la réponse XML en JSON:', error);
        res.status(500).json({ error: 'Erreur lors de la conversion de la réponse XML en JSON' });
      } else {
        // Extraire uniquement les données situées dans la balise listePointRelais
        const listePointRelais = result['soap:Envelope']['soap:Body']['ns1:recherchePointChronopostInterParServiceResponse']['return']['listePointRelais'];
        res.json(listePointRelais);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des données de l\'API Chronopost:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données de l\'API Chronopost' });
  }
});

// Démarrer le serveur HTTPS
httpsServer.listen(port, () => {
  console.log(`Serveur proxy démarré sur le port ${port}`);
});
