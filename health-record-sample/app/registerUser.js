'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
  try {
    const userId = process.argv[2];
    const role = process.argv[3];
    if (!userId || !role) {
      console.log('Usage: node registerUser.js <userId> <role>'); // doctor|patient etc.
      process.exit(1);
    }

    // Load CCP
    const ccpPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // CA client
    const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

    // Wallet
    const walletPath = path.join(__dirname, 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Already exists?
    const userIdentity = await wallet.get(userId);
    if (userIdentity) {
      console.log(`User "${userId}" already exists in the wallet`);
      return;
    }

    // Ensure admin exists
    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
      console.log('Admin identity not found in the wallet. Run enrollAdmin.js first.');
      return;
    }

    // Build provider and admin user context
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    // Register and enroll
    const secret = await ca.register({
      affiliation: 'org1.department1',
      enrollmentID: userId,
      role: 'client',
      attrs: [{ name: 'role', value: role, ecert: true }]
    }, adminUser);

    const enrollment = await ca.enroll({ enrollmentID: userId, enrollmentSecret: secret });

    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: 'Org1MSP',
      type: 'X.509'
    };

    await wallet.put(userId, x509Identity);
    console.log(`Successfully registered and enrolled user "${userId}" with role "${role}"`);
  } catch (error) {
    console.error(`Failed to register user: ${error}`);
    process.exit(1);
  }
}

main();
