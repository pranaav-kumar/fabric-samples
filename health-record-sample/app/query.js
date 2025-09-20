const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const wallet = await Wallets.newFileSystemWallet(path.join(__dirname, 'wallet'));
        const identity = await wallet.get('worker2'); // patient identity
        if (!identity) {
            console.log('❌ User worker not found in wallet.');
            return;
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'worker2',
            discovery: { enabled: false }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('health');

        // Get single record
        const result = await contract.evaluateTransaction('getRecord', 'patient1', 'record1');
        console.log('📄 Record:', JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error(`❌ Failed to query record: ${error}`);
    }
}

main();
