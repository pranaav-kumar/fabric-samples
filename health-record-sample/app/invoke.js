const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const wallet = await Wallets.newFileSystemWallet(path.join(__dirname, 'wallet'));
        const identity = await wallet.get('doc2'); // doctor identity
        if (!identity) {
            console.log('❌ User doc not found in wallet. Run registerUser.js first.');
            return;
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'doc2',
            discovery: { enabled: false } // disable discovery for client
        });

        const network = await gateway.getNetwork('mychannel'); // correct channel
        const contract = network.getContract('health');

        // Submit a new patient record
        await contract.submitTransaction(
            'addRecord',
            'patient1',
            'record1',
            JSON.stringify({ test: 'Blood Test Result: Normal' })
        );

        console.log('✅ Record added successfully');
        await gateway.disconnect();
    } catch (error) {
        console.error(`❌ Failed to submit transaction: ${error}`);
    }
}

main();
