// index.js

// 1. Importa a biblioteca CCXT e o dotenv (para ler o arquivo .env)
// O require('dotenv').config() lerá as chaves do seu arquivo .env local.
const ccxt = require('ccxt');
require('dotenv').config();

// 2. Define o par de moedas que queremos negociar
// Vamos começar com um par comum, como Bitcoin (BTC) contra Dólar (USDT).
const symbol = 'BTC/USDT'; 

// 3. Cria as instâncias das corretoras, lendo as chaves do .env
// Note que o nome das variáveis (MEXC_API_KEY, BITMART_SECRET, etc.)
// deve ser EXATAMENTE igual ao que você usou no arquivo .env.
const mexc = new ccxt.mexc({
    apiKey: process.env.MEXC_API_KEY,
    secret: process.env.MEXC_SECRET,
});

const bitmart = new ccxt.bitmart({
    apiKey: process.env.BITMART_API_KEY,
    secret: process.env.BITMART_SECRET,
    // O memo é específico da BitMart e é necessário se você o configurou
    password: process.env.BITMART_MEMO, 
    // O CCXT usa 'password' para o Memo/Passphrase da BitMart.
});


async function fetchArbitrageData() {
    console.log(`Buscando dados em ${symbol} entre MEXC e BitMart...`);

    try {
        // Obter Livro de Ofertas da MEXC (Order Book)
        const mexcOrderBook = await mexc.fetchOrderBook(symbol);
        const mexcBid = mexcOrderBook.bids[0][0]; // Melhor preço de COMPRA na MEXC
        const mexcAsk = mexcOrderBook.asks[0][0]; // Melhor preço de VENDA na MEXC

        // Obter Livro de Ofertas da BitMart
        const bitmartOrderBook = await bitmart.fetchOrderBook(symbol);
        const bitmartBid = bitmartOrderBook.bids[0][0];
        const bitmartAsk = bitmartOrderBook.asks[0][0];

        console.log(`\n--- Dados em Tempo Real (${symbol}) ---`);
        console.log(`MEXC | Compra (Bid): ${mexcBid} | Venda (Ask): ${mexcAsk}`);
        console.log(`BitMart | Compra (Bid): ${bitmartBid} | Venda (Ask): ${bitmartAsk}`);

        // 4. Lógica de Arbitragem: Calcular a Oportunidade (Spread)
        
        // Cenario 1: Comprar Barato na MEXC (Ask) e Vender Caro na BitMart (Bid)
        let spread1 = 0;
        if (bitmartBid > mexcAsk) {
            spread1 = (bitmartBid / mexcAsk - 1) * 100;
            console.log(`\nOPORTUNIDADE 1 (MEXC -> BitMart): Spread Bruto: ${spread1.toFixed(4)}%`);
        }

        // Cenario 2: Comprar Barato na BitMart (Ask) e Vender Caro na MEXC (Bid)
        let spread2 = 0;
        if (mexcBid > bitmartAsk) {
            spread2 = (mexcBid / bitmartAsk - 1) * 100;
            console.log(`OPORTUNIDADE 2 (BitMart -> MEXC): Spread Bruto: ${spread2.toFixed(4)}%`);
        }

    } catch (error) {
        // Mensagens de erro de conexão ou API Key inválida aparecerão aqui
        console.error('\nOcorreu um erro ao buscar os dados:', error.message);
        console.log('\nVerifique se suas chaves de API no seu arquivo .env local estão corretas e se as permissões foram dadas.');
    }
}

// Roda a função principal
fetchArbitrageData();
