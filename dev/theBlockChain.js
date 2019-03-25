const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];
const uuid = require('uuid/v1');

function TheBlockchain(){
    this.chain = [];
    this.pendingTransactions = [];

    this.createNewBlock(100, '0', '0');   //create genesis block 

    this.currentNodeUrl = currentNodeUrl;
	this.networkNodes = [];
}

TheBlockchain.prototype.createNewBlock = function (nonce, previousBlockHash, hash) { 
    //console.log("Transactions pending " + JSON.stringify(this.pendingTransactions));
    const newBlock = { 
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions, 
        nonce: nonce,
        hash: hash,
        previousBlockHash: previousBlockHash         
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock);

    return newBlock;
}

TheBlockchain.prototype.createNewTransaction = function(amount,
                                                        fileName,
                                                        fileHash, 
                                                        sender, 
                                                        recipient
                                                        ){
    const newTransaction = {
        amount: amount,
        fileName: fileName,
        fileHash: fileHash,
        sender: sender,
        recipient: recipient,
        transactionId: uuid().split('-').join('')
    };
    
    return newTransaction;
}

TheBlockchain.prototype.getLastBlock = function () { 
    return this.chain[this.chain.length - 1];
    
}

TheBlockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const dataAsString = previousBlockHash + nonce.toString()+ JSON.stringify( currentBlockData);
    const hash = sha256(dataAsString);

    return hash;
}

TheBlockchain.prototype.hashFile = function(fileData){
    return sha256(fileData);
}

TheBlockchain.prototype.proofOfWork = function( previousBlockHash, currentBlockData) { 
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData,  nonce);

    while (hash.substring(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }
    return nonce;
}

TheBlockchain.prototype.addTransactionToPendingTransactions = function(transactionObj) {
    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock()['index'] + 1;
};

TheBlockchain.prototype.chainIsValid = function(blockchain) {
    let validChain = true;

    for (var i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i - 1];
        const blockHash = this.hashBlock(prevBlock['hash'], 
            { transactions: currentBlock['transactions'], index: currentBlock['index'] } , currentBlock['nonce'] );

        if (currentBlock['previousBlockHash'] !== prevBlock['hash']) {
           validChain = false;
           console.log('previousBlockHash =>', prevBlock [ 'hash']);
           console.log('currentBlockHash =>', currentBlock [ 'previousBlockHash']);
        }
        if (blockHash.substring(0, 4) !== '0000') validChain = false;
    };
    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock['nonce'] === 100;

    const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
    const correctHash = genesisBlock['hash'] === '0';

    const correctTransactions = genesisBlock['transactions'].length === 0;
    if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

    return validChain;
};

TheBlockchain.prototype.getBlock = function(blockHash) { 
    let correctBlock = null;
    this.chain.forEach(block => {
        if (block.hash === blockHash) correctBlock = block;  
    });
    return correctBlock
};

TheBlockchain.prototype.getTransaction = function(transactionId) {
    let correctTransaction =null;
    let correctBlock = null;  
        this.chain.forEach(block => { 
            block.transactions.forEach(transaction => { 
            if (transaction.transactionId === transactionId) {
                correctTransaction = transaction;         
                correctBlock = block; 
            }; 
        });
    });
    return {
        transaction: correctTransaction,
        block: correctBlock
    };
};

TheBlockchain.prototype.getAddressData = function(address) {
    const addressTransactions = [];
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if(transaction.sender === address || transaction.recipient === address) {
                addressTransactions.push(transaction);
            }
        });
    });
    let balance = 0;
    addressTransactions.forEach(transaction => { 
            if (transaction.recipient === address) balance += transaction.amount;
        else if (transaction.sender === address) balance -= transaction.amount; 
    }); 
    return {
        addressTransactions: addressTransactions,
        addressBalance: balance
    }; 
};
 
module.exports = TheBlockchain;
