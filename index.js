// index.js - Bot de Arbitragem Triangular (MEXC Spot - VERSÃO FINAL CORRIGIDA)

const ccxt = require('ccxt');
require('dotenv').config();
// A linha "const beep = require('beep');" foi removida para evitar o erro de módulo.

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT
// ===========================================

// --- Arbitragem Triangular (Interna - MEXC) ---
// LISTA EXPANDIDA DE PARES PARA MAIS OPORTUNIDADES
const trianglesToMonitor = [
    { alt: 'ETH', pair1: 'ETH/USDT', pair2: 'ETH/BTC', pair3: 'BTC/USDT' },
    { alt: 'SOL', pair1: 'SOL/USDT', pair2: 'SOL/BTC', pair3: 'BTC/USDT' },
    { alt: 'LTC', pair1: 'LTC/USDT', pair2: 'LTC/BTC', pair3: 'BTC/USDT' },
    { alt: 'ADA', pair1: 'ADA/USDT', pair2: 'ADA/BTC', pair3: 'BTC/USDT' },
    { alt: 'MATIC', pair1: 'MATIC/USDT', pair2: 'MATIC/BTC', pair3: 'BTC/USDT' },
    { alt: 'XRP', pair1: 'XRP/USDT', pair2: 'XRP/BTC', pair3: 'BTC/USDT' },
    { alt: 'DOGE', pair1: 'DOGE/USDT', pair2: 'DOGE/BTC', pair3: 'BTC/USDT' },
    { alt: 'TRX', pair1: 'TRX/USDT', pair2: 'TRX/BTC', pair3: 'BTC/USDT' },
    { alt: 'DOT', pair1: 'DOT/USDT', pair2: 'DOT/BTC', pair3: 'BTC/USDT' },
];

// LUCRO MÍNIMO AJUSTADO PARA 0.01% para aumentar a frequência de operações.
const minProfitTriangular = 0.0001; 

// --- Configurações de Execução ---
const interval = 3000; // Intervalo de busca (3 segundos)
const mexcFee = 0.001; // 0.1% Taker Fee
const tradeAmountUSDT = 10; // CAPITAL INICIAL POR OPERAÇÃO (em USDT)

// ===========================================
// INSTÂNCIAS DAS CORRETORAS (APENAS MEXC)
// ===========================================

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
        'adjustForTimeDifference': true, 
    },
    timeout: 15000 
});

let marketInfo = {}; 

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
    
    if (!marketInfo[pair1] || !marketInfo[pair2] || !marketInfo[pair3]) {
        console.error("❌ Erro: Informações de mercado não carregadas. Pulando execução.");
        return;
    }

    console.log(`\n================== 🚀 EXECUÇÃO INICIADA na MEXC ==================`);
    console.log('\x07\x07\x07'); // 🔔 ALERTA SONORO (BELL CHAR)
    console.log(`  Triângulo: ${alt}/BTC/USDT | Lucro Líquido: ${profitPercent.toFixed(4)}% | Rota: ${direction}`);
    console.log(`  Capital: ${tradeAmountUSDT} USDT`);

    try {
        if (direction === 'Direta') { // USDT -> ALT -> BTC -> USDT
            const [price1, price2, price3] = prices;

            // 1. COMPRAR ALT com USDT (em ALT/USDT)
            let amount1_alt = tradeAmountUSDT / price1;
            amount1_alt = mexc.amountToPrecision(pair1, amount1_alt); 
            console.log(`  -> 1. BUY ${amount1_alt} ${alt} em ${pair1} @ ${price1}`);
            const order1 = await mexc.createMarketBuyOrder(pair1, amount1_alt); 
            
            // 2. VENDER ALT por BTC (em ALT/BTC)
            let amount2_alt = parseFloat(order1.filled); 
            amount2_alt = mexc.amountToPrecision(pair2, amount2_alt);
            console.log(`  -> 2. SELL ${amount2_alt} ${alt} em ${pair2} @ ${price2}`);
            const order2 = await mexc.createMarketSellOrder(pair2, amount2_alt);
            
            // 3. VENDER BTC por USDT (em BTC/USDT)
            let amount3_btc = parseFloat(order2.cost); 
            amount3_btc = mexc.amountToPrecision(pair3, amount3_btc);
            console.log(`  -> 3. SELL ${amount3_btc} BTC em ${pair3} @ ${price3}`);
            const order3 = await mexc.createMarketSellOrder(pair3, amount3_btc);
            
            console.log(`\n✅ ARBITRAGEM COMPLETA. Retorno Final (Aproximado): ${parseFloat(order3.cost).toFixed(4)} USDT.`);
        } else {
             // Rota Inversa (USDT -> BTC -> ALT -> USDT) não implementada para execução
             console.log("  ⚠️ Rota Inversa detectada, mas a execução está desabilitada para simplificação.");
        }

    } catch (error) {
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
            exchange.fetchOrderBook(pair1), 
            exchange.fetchOrderBook(pair2), 
            exchange.fetchOrderBook(pair3), 
        ]);
        
        // Cenario 1: Rota Direta (USDT -> Alt -> BTC -> USDT)
        const price1_buy_alt_usdt = book1.asks[0][0]; 
        const price2_sell_alt_btc = book2.bids[0][0]; 
        const price3_sell_btc_usdt = book3.bids[0][0]; 

        let finalUSDT_route1 = (1 / price1_buy_alt_usdt) * price2_sell_alt_btc * price3_sell_btc_usdt;
        const netProfit1 = finalUSDT_route1 - 1 - (3 * mexcFee); 
        
        // Cenario 2: Rota Inversa (USDT -> BTC -> Alt -> USDT)
        const price1_buy_btc_usdt = book3.asks[0][0];
        const price2_buy_alt_btc = book2.asks[0][0]; 
        const price3_sell_alt_usdt = book1.bids[0][0];

        let finalUSDT_route2 = (1 / price1_buy_btc_usdt) / price2_buy_alt_btc * price3_sell_alt_usdt;
        const netProfit2 = finalUSDT_route2 - 1 - (3 * mexcFee); 

        // ANÁLISE E EXECUÇÃO
        if (netProfit1 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit1 * 100), [price1_buy_alt_usdt, price2_sell_alt_btc, price3_sell_btc_usdt], 'Direta');
        } else if (netProfit2 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit2 * 100), [price1_buy_btc_usdt, price2_buy_alt_btc, price3_sell_alt_usdt], 'Inversa');
        } 

    } catch (error) {
        if (!error.message.includes('symbol is not supported')) {
            // console.log(`❌ ERRO NO MONITORAMENTO TRIANGULAR de ${alt}: ${error.message}`);
        }
    }
}


// ===========================================
// FUNÇÃO PRINCIPAL QUE RODA EM LOOP
// ===========================================

async function mainLoop() {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA TRIANGULAR...`);
    
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

(async () => {
    // ⚠️ Lembre-se de verificar se as chaves API no .env estão corretas
    // O bot DEVE mostrar: "API Key lida: Lida com sucesso" no início.
    await loadMarkets(); 
    setInterval(mainLoop, interval); 
})();
