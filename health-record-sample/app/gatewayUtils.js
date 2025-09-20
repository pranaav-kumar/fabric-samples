const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const ccpPath = path.resolve(
  __dirname,
  '..', '..', 'test-network',
  'organizations', 'peerOrganizations', 'org1.example.com',
  'connection-org1.json'
);

async function buildCAClient() {
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
  const ca = new FabricCAServices(caURL);
  return { ca, ccp };
}

async function buildWallet() {
  const walletPath = path.join(process.cwd(), 'wallet');
  await fse.ensureDir(walletPath);
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  return wallet;
}

module.exports = { buildCAClient, buildWallet, ccpPath };
