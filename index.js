// index.js - Bot de Arbitragem Triangular (Apenas MEXC - Versão Final)

const ccxt = require('ccxt');
require('dotenv').config();

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT
// ===========================================

// --- Arbitragem Triangular (Interna - MEXC) ---
// Estrutura: { alt: Nome, pair1: ALT/USDT, pair2: ALT/BTC, pair3: BTC/USDT }
const trianglesToMonitor = [
    { alt: 'ETH', pair1: 'ETH/USDT', pair2: 'ETH/BTC', pair3: 'BTC/USDT' },
    // Adicione mais triângulos aqui, verificando se os pares existem na MEXC.
];
const minProfitTriangular = 0.0005; // 0.05% de lucro líquido MÍNIMO

// --- Configurações de Execução ---
const interval = 3000; // Intervalo de busca (3 segundos)
const mexcFee = 0.001; // 0.1% Taker Fee
const tradeAmountUSDT = 10; // VALOR EM USDT PARA NEGOCIAR (AJUSTE CONFORME SEU SALDO!)

// ===========================================
// INSTÂNCIAS DAS CORRETORAS (APENAS MEXC)
// ===========================================

// ⭐️ BLOCO DE TESTE DE VARIÁVEIS DE AMBIENTE ⭐️
// Se este log falhar, o problema é o arquivo .env (nome, localização, ou aspas).
console.log('--- TESTE DE LEITURA DE CHAVES ---');
console.log('API Key lida:', process.env.MEXC_API_KEY ? 'Lida com sucesso' : '❌ ERRO: Chave API não lida');
console.log('Secret Key lida:', process.env.MEXC_SECRET ? 'Lida com sucesso' : '❌ ERRO: Chave Secreta não lida');
console.log('---------------------------------');

const mexc = new ccxt.mexc({
    // Correção: Usar process.env para carregar as chaves do .env
    apiKey: process.env.MEXC_API_KEY,  
    secret: process.env.MEXC_SECRET,
    options: { 
        defaultFees: { 
            trading: { 
                taker: mexcFee 
            } 
        },
        // ⭐️ CORREÇÃO FINAL DE FUSO HORÁRIO ⭐️
        // O ccxt tentará sincronizar o tempo automaticamente (mais robusto)
        'adjustForTimeDifference': true, 
    }
});

// ===========================================
// FUNÇÃO DE EXECUÇÃO DE ORDEM (LOG APENAS)
// ===========================================

async function executeTriangularArbitrage(triangle, profitPercent, amountUSDT) {
    console.log(`\n================== 🚀 ALERTA DE EXECUÇÃO TRIANGULAR na MEXC ==================`);
    console.log(`  Triângulo: ${triangle.alt}/BTC/USDT | Lucro Líquido: ${profitPercent.toFixed(4)}%`);
    console.log(`  Capital: ${amountUSDT} USDT`);
    
    // !!! ATENÇÃO: A EXECUÇÃO REAL ESTÁ COMENTADA. DESCOMENTE PARA ATIVAR O BOT. !!!
    /*
    try {
        // Implementar a lógica de cálculo de lotes (lotSize) e execução das 3 ordens aqui.
        // Ordem 1: Compra/Venda
        // Ordem 2: Compra/Venda
        // Ordem 3: Compra/Venda

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

        // ANÁLISE E LOG
        if (netProfit1 > minProfitTriangular) {
            console.log(`\n💎 OPORTUNIDADE TRIANGULAR na MEXC (${alt}/BTC/USDT) - Direta`);
            console.log(`  Lucro Líquido: ${(netProfit1 * 100).toFixed(4)}%`);
            await executeTriangularArbitrage(triangle, (netProfit1 * 100), tradeAmountUSDT); 
        } else if (netProfit2 > minProfitTriangular) {
            console.log(`\n💎 OPORTUNIDADE TRIANGULAR na MEXC (${alt}/BTC/USDT) - Inversa`);
            console.log(`  Lucro Líquido: ${(netProfit2 * 100).toFixed(4)}%`);
            await executeTriangularArbitrage(triangle, (netProfit2 * 100), tradeAmountUSDT); 
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
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA TRIANGULAR (APENAS MEXC)...`);
    
    // 1. Checagem de Saldo (Obrigatória antes de negociar)
    let balancesChecked = true;
    try {
        // Isso tentará buscar o saldo e falhará se a chave API for rejeitada.
        const mexcBalance = await mexc.fetchBalance();
        const mexcUSDT = mexcBalance.USDT ? mexcBalance.USDT.free : 0;
        
        if (mexcUSDT < tradeAmountUSDT) {
             console.log(`AVISO: Saldo insuficiente de USDT (${tradeAmountUSDT} USDT necessários). Saldo: ${mexcUSDT.toFixed(2)} USDT.`);
             balancesChecked = false;
        } else {
             console.log(`✅ SALDO OK. Capital de Negociação: ${tradeAmountUSDT} USDT. Saldo Atual: ${mexcUSDT.toFixed(2)} USDT.`);
        }

    } catch (error) {
        // Se este erro ocorrer, a única causa é chave inválida ou sincronização de tempo.
        console.error('❌ ERRO FATAL ao checar saldos da MEXC. Verifique suas chaves API. Pulando negociações.');
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
