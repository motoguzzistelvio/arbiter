const TheBlockchain = require('./theBlockchain');

const bitcoin = new TheBlockchain();

const previousBlockHash = '87765DA6CCF0668238C1D27C35692E11';
const currentBlockData = [
    {
        amount: 10,
        sender: 'B4CEE9C0E5CD571',
        recipient: '3A3F6E462D48E9',  
    },  
    {
        amount: 75,
        sender: 'B7CEF9C0E5CD571',
        recipient: '3A3F6E462D48E9',  
    },
    {
        amount: 102,
        sender: 'B4BB9C0E5CD571',
        recipient: '3A3F66E62D48E9',  
    }    
]

const nonce = 100;

//console.log(bitcoin.proofOfWork(previousBlockHash, currentBlockData));

console.log(bitcoin.hashBlock(previousBlockHash, currentBlockData, 80156 )); 
