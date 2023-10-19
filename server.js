const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const app = express();
const port = 443; // Le port HTTPS standard

app.use(cors());

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simulate btoa function for Node.js
function btoa(str) {
  return Buffer.from(str, 'binary').toString('base64');
}

// CreateFormToken function
const createFormToken = async (paymentConf) => {
  const username = '51162627';
  const password = 'testpassword_jmwQAY6pjeEcY7xQ1U9lm8xSFaniynic3chkbJ47UCcZs';
  const endpoint = 'api.systempay.fr'; // Without https

  const createPaymentEndpoint = `https://${username}:${password}@${endpoint}/api-payment/V4/Charge/CreatePayment`;

  try {
    const response = await axios.post(createPaymentEndpoint, paymentConf, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${username}:${password}`),
      },
    });

    const responseData = response.data;

    console.log(responseData);

    if (!responseData?.answer?.formToken) {
      throw responseData;
    }

    return responseData.answer.formToken;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// CreatePayment route
app.post('/createPayment', async (req, res) => {
  const paymentConf = req.body.paymentConf;

  try {
    const formToken = await createFormToken(paymentConf);

    if (formToken) {
      res.json({ formToken });
    } else {
      res.status(500).json({ error: "Aucun formToken reçu de l'API" });
    }
  } catch (error) {
    res.status(500).json({ error: "Une erreur s'est produite lors du traitement de la demande" });
  }
});

// Charger les certificats SSL
const privateKey = fs.readFileSync('/etc/ssl/private/ssl-cert-snakeoil.key', 'utf8');
const certificate = fs.readFileSync('/etc/ssl/certs/ssl-cert-snakeoil.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Créez un serveur HTTPS
const httpsServer = https.createServer(credentials, app);

// Écoutez sur le port HTTPS (443)
httpsServer.listen(port, () => {
  console.log(`Server is listening at https://localhost`);
});
