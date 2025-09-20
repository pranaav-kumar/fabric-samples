const express = require('express');
const bodyParser = require('body-parser');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { buildWallet, ccpPath } = require('./gatewayUtils');

const app = express();
app.use(bodyParser.json());

async function getContractForUser(username) {
  const wallet = await Wallets.newFileSystemWallet(path.join(process.cwd(), 'wallet'));
  const identity = await wallet.get(username);
  if (!identity) throw new Error(`Identity ${username} not found in wallet. Register/enroll first.`);

  const gateway = new Gateway();
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  await gateway.connect(ccp, {
    wallet,
    identity: username,
    discovery: { enabled: true, asLocalhost: false }
  });

  const network = await gateway.getNetwork('mychannel');
  const contract = network.getContract('health');
  return { contract, gateway };
}

// Doctor adds a record
// POST /doctor/addRecord
// body: { doctor: 'doctor1', patientId: 'patient1', recordId: 'r1', recordData: { ... } }
app.post('/doctor/addRecord', async (req, res) => {
  try {
    const { doctor, patientId, recordId, recordData } = req.body;
    const { contract, gateway } = await getContractForUser(doctor);
    const tx = await contract.submitTransaction('addRecord', patientId, recordId, JSON.stringify(recordData));
    await gateway.disconnect();
    res.json({ success: true, result: tx.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message || err.toString(), details: err });

  }
});

// Patient reads own records
// GET /patient/records?user=patient1&patientId=patient1
app.get('/patient/records', async (req, res) => {
  try {
    const { user, patientId } = req.query;
    const { contract, gateway } = await getContractForUser(user);
    const result = await contract.evaluateTransaction('queryRecordsByPatient', patientId);
    await gateway.disconnect();
    res.json({ result: JSON.parse(result.toString()) });
  } catch (err) {
    res.status(500).json({ error: err.message || err.toString(), details: err });

  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
