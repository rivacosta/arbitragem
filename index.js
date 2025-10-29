// index.js - Bot de Arbitragem Triangular (MEXC Spot - VERSÃO FINAL COM EXECUÇÃO)

const ccxt = require('ccxt');
require('dotenv').config();

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT
// ===========================================

// --- Arbitragem Triangular (Interna - MEXC) ---
// Estrutura: { alt: Nome, pair1: ALT/USDT, pair2: ALT/BTC, pair3: BTC/USDT }
const trianglesToMonitor = [
    { alt: 'ETH', pair1: 'ETH/USDT', pair2: 'ETH/BTC', pair3: 'BTC/USDT' },
    { alt: 'SOL', pair1: 'SOL/USDT', pair2: 'SOL/BTC', pair3: 'BTC/USDT' },
    // Adicione mais triângulos aqui...
];
const minProfitTriangular = 0.0005; // 0.05% de lucro líquido MÍNIMO

// --- Configurações de Execução ---
const interval = 3000; // Intervalo de busca (3 segundos)
const mexcFee = 0.001; // 0.1% Taker Fee
const tradeAmountUSDT = 10; // CAPITAL INICIAL POR OPERAÇÃO (em USDT)

// ===========================================
// INSTÂNCIAS DAS CORRETORAS (APENAS MEXC)
// ===========================================

// ⭐️ BLOCO DE TESTE DE VARIÁVEIS DE AMBIENTE ⭐️
console.log('--- TESTE DE LEITURA DE CHAVES ---');
console.log('API Key lida:', process.env.MEXC_API_KEY ? 'Lida com sucesso' : '❌ ERRO: Chave API não lida');
console.log('Secret Key lida:', process.env.MEXC_SECRET ? 'Lida com sucesso' : '❌ ERRO: Chave Secreta não lida');
console.log('---------------------------------');

const mexc = new ccxt.mexc({
    apiKey: process.env.MEXC_API_KEY,  
    secret: process.env.MEXC_SECRET,
    options: { 
        defaultFees: { 
            trading: { 
                taker: mexcFee 
            } 
        },
        // Correção de Fuso Horário: CCXT ajusta automaticamente o offset
        'adjustForTimeDifference': true, 
    },
    // Ajuste o timeout se as requisições demorarem
    timeout: 15000 
});

// Armazenamento de informações de mercado (necessário para formatação de lotes)
let marketInfo = {}; 

// Função para carregar informações de mercado
async function loadMarkets() {
    try {
        console.log("Carregando mercados da MEXC...");
        marketInfo = await mexc.loadMarkets();
        console.log("Mercados carregados com sucesso.");
    } catch (error) {
        console.error("❌ ERRO ao carregar mercados. O bot pode não conseguir formatar os lotes corretamente.", error.message);
    }
}


// ===========================================
// FUNÇÃO DE EXECUÇÃO DE ORDEM (AGORA ATIVA)
// ===========================================

async function executeTriangularArbitrage(triangle, profitPercent, prices, direction) {
    const { alt, pair1, pair2, pair3 } = triangle;
    
    // Assegura que as informações de mercado estão carregadas para usar o .amountToPrecision
    if (!marketInfo[pair1] || !marketInfo[pair2] || !marketInfo[pair3]) {
        console.error("❌ Erro: Informações de mercado não carregadas. Pulando execução.");
        return;
    }

    console.log(`\n================== 🚀 EXECUÇÃO INICIADA na MEXC ==================`);
    console.log(`  Triângulo: ${alt}/BTC/USDT | Lucro Líquido: ${profitPercent.toFixed(4)}% | Rota: ${direction}`);
    console.log(`  Capital: ${tradeAmountUSDT} USDT`);

    try {
        if (direction === 'Direta') { // USDT -> ALT -> BTC -> USDT
            const [price1, price2, price3] = prices;

            // 1. COMPRAR ALT com USDT (em ALT/USDT)
            // Lote: 10 USDT / Preço Ask
            let amount1_alt = tradeAmountUSDT / price1;
            amount1_alt = mexc.amountToPrecision(pair1, amount1_alt); // Ajusta precisão
            console.log(`  -> 1. BUY ${amount1_alt} ${alt} em ${pair1} @ ${price1}`);
            const order1 = await mexc.createMarketBuyOrder(pair1, amount1_alt); 
            
            // 2. VENDER ALT por BTC (em ALT/BTC)
            // Lote: O resultado da Ordem 1 (em ALT)
            let amount2_alt = parseFloat(order1.filled); // Quantidade exata comprada
            amount2_alt = mexc.amountToPrecision(pair2, amount2_alt);
            console.log(`  -> 2. SELL ${amount2_alt} ${alt} em ${pair2} @ ${price2}`);
            const order2 = await mexc.createMarketSellOrder(pair2, amount2_alt);
            
            // 3. VENDER BTC por USDT (em BTC/USDT)
            // Lote: A quantidade de BTC obtida na Ordem 2
            let amount3_btc = parseFloat(order2.cost); // cost é o que você recebeu (BTC)
            amount3_btc = mexc.amountToPrecision(pair3, amount3_btc);
            console.log(`  -> 3. SELL ${amount3_btc} BTC em ${pair3} @ ${price3}`);
            const order3 = await mexc.createMarketSellOrder(pair3, amount3_btc);
            
            console.log(`\n✅ ARBITRAGEM COMPLETA. Retorno Final (Aproximado): ${parseFloat(order3.cost).toFixed(4)} USDT.`);
        } else {
             // A lógica de execução da Rota Inversa (USDT -> BTC -> ALT -> USDT)
             // deve ser implementada aqui, seguindo os mesmos passos.
             console.log("  ⚠️ Rota Inversa detectada, mas a execução está desabilitada neste modelo.");
        }

    } catch (error) {
        // Erro comum: Falha na Ordem de Mercado ou problema de saldo/lote
        console.error(`\n❌ ERRO FATAL AO EXECUTAR ARBITRAGEM: ${error.message}`);
        console.log(`  Verifique se o seu saldo e as precisões de lote estão corretas.`);
    }
    console.log(`================================================================================`);
}


// ===========================================
// LÓGICA DE ARBITRAGEM TRIANGULAR (MECX)
// ===========================================

async function checkTriangularArbitrage(exchange, triangle) {
    const { alt, pair1, pair2, pair3 } = triangle;
    
    try {
        // 1. BUSCAR LIVROS DE OFERTAS
        const [book1, book2, book3] = await Promise.all([
            exchange.fetchOrderBook(pair1), // Ex: SOL/USDT
            exchange.fetchOrderBook(pair2), // Ex: SOL/BTC
            exchange.fetchOrderBook(pair3), // Ex: BTC/USDT
        ]);
        
        // Cenario 1: Rota Direta (USDT -> Alt -> BTC -> USDT)
        const price1_buy_alt_usdt = book1.asks[0][0]; 
        const price2_sell_alt_btc = book2.bids[0][0]; 
        const price3_sell_btc_usdt = book3.bids[0][0]; 

        let finalUSDT_route1 = (1 / price1_buy_alt_usdt) * price2_sell_alt_btc * price3_sell_btc_usdt;
        const netProfit1 = finalUSDT_route1 - 1 - (3 * mexcFee); // 3 taxas
        
        // Cenario 2: Rota Inversa (USDT -> BTC -> Alt -> USDT)
        const price1_buy_btc_usdt = book3.asks[0][0];
        const price2_buy_alt_btc = book2.asks[0][0]; 
        const price3_sell_alt_usdt = book1.bids[0][0];

        let finalUSDT_route2 = (1 / price1_buy_btc_usdt) / price2_buy_alt_btc * price3_sell_alt_usdt;
        const netProfit2 = finalUSDT_route2 - 1 - (3 * mexcFee); // 3 taxas

        // ANÁLISE E LOG
        if (netProfit1 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit1 * 100), [price1_buy_alt_usdt, price2_sell_alt_btc, price3_sell_btc_usdt], 'Direta');
        } else if (netProfit2 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit2 * 100), [price1_buy_btc_usdt, price2_buy_alt_btc, price3_sell_alt_usdt], 'Inversa');
        } 

    } catch (error) {
        if (!error.message.includes('symbol is not supported')) {
            // Log de erros silenciosos (ex: symbol not supported) para manter o console limpo
        }
    }
}


// ===========================================
// FUNÇÃO PRINCIPAL QUE RODA EM LOOP
// ===========================================

async function mainLoop() {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA TRIANGULAR...`);
    
    // 1. Checagem de Saldo (Obrigatória antes de negociar)
    let balancesChecked = true;
    try {
        const mexcBalance = await mexc.fetchBalance();
        const mexcUSDT = mexcBalance.USDT ? mexcBalance.USDT.free : 0;
        
        if (mexcUSDT < tradeAmountUSDT) {
             console.log(`AVISO: Saldo insuficiente de USDT (${tradeAmountUSDT} USDT necessários). Saldo: ${mexcUSDT.toFixed(2)} USDT.`);
             balancesChecked = false;
        } else {
             console.log(`✅ SALDO OK. Capital de Negociação: ${tradeAmountUSDT} USDT. Saldo Atual: ${mexcUSDT.toFixed(2)} USDT.`);
        }

    } catch (error) {
        console.error('❌ ERRO FATAL ao checar saldos da MEXC. O bot não pode negociar. Reinicie.');
        return; 
    }
    
    // 2. Monitoramento de Arbitragem Triangular (Se Saldo OK)
    if (balancesChecked) {
        for (const triangle of trianglesToMonitor) {
            await checkTriangularArbitrage(mexc, triangle); 
        }
    } 
    
    console.log(`Busca Finalizada. Esperando ${interval / 1000}s...`);
}


// ===========================================
// INÍCIO DO BOT
// ===========================================

// Chamada inicial para carregar as informações de mercado e iniciar o loop
(async () => {
    await loadMarkets(); // Carrega mercados uma vez
    setInterval(mainLoop, interval); // Inicia o loop principal
})();
