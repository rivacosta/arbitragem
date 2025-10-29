// index.js - Bot de Arbitragem Triangular (Apenas MEXC - V7.0)

const ccxt = require('ccxt');
require('dotenv').config();

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT
// ===========================================

// --- Arbitragem Triangular (Interna - MEXC) ---
// Estrutura: { alt: Nome, pair1: ALT/USDT, pair2: ALT/BTC, pair3: BTC/USDT }
// A base (USDT) e a moeda intermediária (BTC) devem ser comuns a todos os pares.
const trianglesToMonitor = [
    { alt: 'ETH', pair1: 'ETH/USDT', pair2: 'ETH/BTC', pair3: 'BTC/USDT' },
    { alt: 'SOL', pair1: 'SOL/USDT', pair2: 'SOL/BTC', pair3: 'BTC/USDT' },
    { alt: 'LINK', pair1: 'LINK/USDT', pair2: 'LINK/BTC', pair3: 'BTC/USDT' },
    { alt: 'MATIC', pair1: 'MATIC/USDT', pair2: 'MATIC/BTC', pair3: 'BTC/USDT' },
    { alt: 'AVAX', pair1: 'AVAX/USDT', pair2: 'AVAX/BTC', pair3: 'BTC/USDT' },
    { alt: 'DOT', pair1: 'DOT/USDT', pair2: 'DOT/BTC', pair3: 'BTC/USDT' },
    { alt: 'LTC', pair1: 'LTC/USDT', pair2: 'LTC/BTC', pair3: 'BTC/USDT' },
    { alt: 'PEPE', pair1: 'PEPE/USDT', pair2: 'PEPE/BTC', pair3: 'BTC/USDT' },
    { alt: 'SHIB', pair1: 'SHIB/USDT', pair2: 'SHIB/BTC', pair3: 'BTC/USDT' },
    { alt: 'DOGE', pair1: 'DOGE/USDT', pair2: 'DOGE/BTC', pair3: 'BTC/USDT' },
    // Adicione mais triângulos aqui, verificando se os pares (ALT/USDT, ALT/BTC) existem na MEXC.
];
const minProfitTriangular = 0.0005; // 0.05% de lucro líquido MÍNIMO

// --- Configurações de Execução ---
const interval = 3000; // Intervalo de busca (3 segundos)
const mexcFee = 0.001; // 0.1% Taker Fee
const tradeAmountUSDT = 10; // VALOR EM USDT PARA NEGOCIAR (AJUSTE CONFORME SEU SALDO!)

// ===========================================
// INSTÂNCIAS DAS CORRETORAS (APENAS MEXC)
// ===========================================

// Seu fuso horário é GMT -3. O servidor MEXC é UTC (GMT 0).
// O 'timeDifference' adiciona 3 horas em milissegundos para compensar o seu horário local.
const TIME_OFFSET_MS = 3 * 60 * 60 * 1000; // 10.800.000 ms

// ⭐️ BLOCO DE TESTE DE VARIÁVEIS DE AMBIENTE ⭐️
// Se as chaves não estiverem sendo lidas, o erro está no seu arquivo .env.
console.log('--- TESTE DE LEITURA DE CHAVES ---');
console.log('API Key lida:', process.env.MEXC_API_KEY ? 'Lida com sucesso' : 'ERRO: Chave API não lida');
console.log('Secret Key lida:', process.env.MEXC_SECRET ? 'Lida com sucesso' : 'ERRO: Chave Secreta não lida');
console.log('Comprimento da API Key:', process.env.MEXC_API_KEY ? process.env.MEXC_API_KEY.length : 'N/A');
console.log('Comprimento da Secret Key:', process.env.MEXC_SECRET ? process.env.MEXC_SECRET.length : 'N/A');
console.log('---------------------------------');
// ---------------------------------

const mexc = new ccxt.mexc({
    // CORREÇÃO FINAL: USAR DIRETAMENTE process.env para evitar o ReferenceError
    apiKey: process.env.MEXC_API_KEY,  
    secret: process.env.MEXC_SECRET,
    options: { 
        defaultFees: { 
            trading: { 
                taker: mexcFee 
            } 
        },
        // APLICA O DESLOCAMENTO DE TEMPO (Correção de Fuso Horário)
        'timeDifference': TIME_OFFSET_MS, 
    }
});

// ===========================================
// FUNÇÃO DE EXECUÇÃO DE ORDEM (LOG APENAS)
// ===========================================

// Esta função agora é mais simples, pois não há exchange de compra/venda diferente
async function executeTriangularArbitrage(triangle, profitPercent, amountUSDT, lotSize1, lotSize2, lotSize3) {
    console.log(`\n================== 🚀 ALERTA DE EXECUÇÃO TRIANGULAR na MEXC ==================`);
    console.log(`  Triângulo: ${triangle.alt}/BTC/USDT | Lucro Líquido: ${profitPercent.toFixed(4)}%`);
    console.log(`  Capital: ${amountUSDT} USDT`);
    
    // !!! ATENÇÃO: A EXECUÇÃO REAL ESTÁ COMENTADA. DESCOMENTE PARA ATIVAR O BOT. !!!
    /*
    try {
        // Exemplo de execução das 3 ordens (adaptar preços e lados da ordem)
        // 1. Ordem de Compra (e.g., ALT/USDT)
        const order1 = await mexc.createLimitBuyOrder(triangle.pair1, lotSize1, price1);
        // 2. Ordem Intermediária (e.g., ALT/BTC)
        const order2 = await mexc.createLimitSellOrder(triangle.pair2, lotSize2, price2);
        // 3. Ordem Final (e.g., BTC/USDT)
        const order3 = await mexc.createLimitSellOrder(triangle.pair3, lotSize3, price3);

        console.log(`  -> Ordens enviadas. Verifique na MEXC.`);
    } catch (error) {
        console.error(`\n❌ ERRO FATAL AO CRIAR ORDEM TRIANGULAR: ${error.message}`);
    }
    */
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
        // 1. Comprar ALT com USDT (Ask de ALT/USDT)
        const price1_buy_alt_usdt = book1.asks[0][0]; 
        // 2. Vender ALT por BTC (Bid de ALT/BTC)
        const price2_sell_alt_btc = book2.bids[0][0]; 
        // 3. Vender BTC por USDT (Bid de BTC/USDT)
        const price3_sell_btc_usdt = book3.bids[0][0]; 

        // Cálculo do lucro simulado: começando com 1 USDT
        let finalUSDT_route1 = (1 / price1_buy_alt_usdt) * price2_sell_alt_btc * price3_sell_btc_usdt;
        const netProfit1 = finalUSDT_route1 - 1 - (3 * mexcFee); // 3 taxas
        
        // Cenario 2: Rota Inversa (USDT -> BTC -> Alt -> USDT)
        // 1. Comprar BTC com USDT (Ask de BTC/USDT)
        const price1_buy_btc_usdt = book3.asks[0][0];
        // 2. Comprar ALT com BTC (Ask de ALT/BTC, depois inverter)
        const price2_buy_alt_btc = book2.asks[0][0]; 
        // 3. Vender ALT por USDT (Bid de ALT/USDT)
        const price3_sell_alt_usdt = book1.bids[0][0];

        // Cálculo do lucro simulado: começando com 1 USDT
        let finalUSDT_route2 = (1 / price1_buy_btc_usdt) / price2_buy_alt_btc * price3_sell_alt_usdt;
        const netProfit2 = finalUSDT_route2 - 1 - (3 * mexcFee); // 3 taxas

        // ANÁLISE E LOG
        if (netProfit1 > minProfitTriangular) {
            console.log(`\n💎 OPORTUNIDADE TRIANGULAR na MEXC (${alt}/BTC/USDT) - Direta`);
            console.log(`  Lucro Líquido: ${(netProfit1 * 100).toFixed(4)}%`);
            await executeTriangularArbitrage(triangle, (netProfit1 * 100), tradeAmountUSDT, tradeAmountUSDT/price1_buy_alt_usdt, null, null); // Lotes simplificados
        } else if (netProfit2 > minProfitTriangular) {
            console.log(`\n💎 OPORTUNIDADE TRIANGULAR na MEXC (${alt}/BTC/USDT) - Inversa`);
            console.log(`  Lucro Líquido: ${(netProfit2 * 100).toFixed(4)}%`);
            await executeTriangularArbitrage(triangle, (netProfit2 * 100), tradeAmountUSDT, null, null, null); // Lotes simplificados
        } 

    } catch (error) {
        // Ignora erros de pares não suportados (comum em altcoins/BTC com baixa liquidez)
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
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA TRIANGULAR (APENAS MEXC)...`);
    
    // 1. Checagem de Saldo (Obrigatória antes de negociar)
    let balancesChecked = true;
    try {
        const mexcBalance = await mexc.fetchBalance();
        const mexcUSDT = mexcBalance.USDT ? mexcBalance.USDT.free : 0;
        const mexcBTC = mexcBalance.BTC ? mexcBalance.BTC.free : 0; // Também precisamos de BTC para a rota inversa
        
        if (mexcUSDT < tradeAmountUSDT) {
             console.log(`AVISO: Saldo insuficiente de USDT (${tradeAmountUSDT} USDT necessários). Saldo: ${mexcUSDT.toFixed(2)} USDT.`);
             balancesChecked = false;
        } else {
             console.log(`SALDO OK. Capital de Negociação: ${tradeAmountUSDT} USDT.`);
        }

    } catch (error) {
        console.error('❌ ERRO ao checar saldos da MEXC. Verifique suas chaves API. Pulando negociações.');
        return; 
    }
    
    // 2. Monitoramento de Arbitragem Triangular (Se Saldo OK)
    if (balancesChecked) {
        for (const triangle of trianglesToMonitor) {
            await checkTriangularArbitrage(mexc, triangle); 
        }
    } else {
          console.log('Monitoramento de Arbitragem Triangular desativado devido ao saldo de USDT insuficiente.');
    }
    
    console.log(`Busca Finalizada. Esperando ${interval / 1000}s...`);
}


// Roda a função principal em loop
setInterval(mainLoop, interval);
