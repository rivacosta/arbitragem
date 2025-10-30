// index.js - Bot de Arbitragem Triangular (OKX SPOT - VERSÃO FINAL COM MARGEM 0.03%)

const ccxt = require('ccxt');
require('dotenv').config();
const fs = require('fs'); 

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT
// ===========================================

// --- Arbitragem Triangular (Interna - OKX) ---
let trianglesToMonitor = []; // Lista gerada automaticamente

// CORREÇÃO: LUCRO MÍNIMO AUMENTADO PARA 0.03% (0.0003)
const minProfitTriangular = 0.0003; 

// --- Configurações de Execução ---
const interval = 1000; // Intervalo de busca (1 segundo)
const okxFee = 0.001; // Taxa Taker (0.1%)
// CORREÇÃO: CAPITAL AUMENTADO PARA $30 USDT
const tradeAmountUSDT = 30; 

// ===========================================
// FUNÇÃO PARA REGISTRAR LOG EM ARQUIVO CSV
// ===========================================
function logTransaction(status, triangle, profitPercent, prices, message) {
    const timestamp = new Date().toISOString();
    
    const profit = profitPercent ? profitPercent.toFixed(4) + '%' : 'N/A';
    
    // Assumindo que o triângulo gerado tenha .alt, .base e .quote (BTC/USDT)
    const triangleString = `${triangle.alt}/${triangle.base}/${triangle.quote}`; 
    
    const logLine = `${timestamp},${status},${triangleString},${profit},"${prices.join('|')}","${message.replace(/"/g, '""')}"\n`;
    const logFile = 'arbitragem_log.csv';
    
    if (!fs.existsSync(logFile)) {
        const header = 'Timestamp,Status,Triangulo,Lucro_Liquido,Precos_Ordem,Mensagem\n';
        fs.writeFileSync(logFile, header);
    }
    
    fs.appendFileSync(logFile, logLine);
}

// ===========================================
// INSTÂNCIAS DAS CORRETORAS (OKX)
// ===========================================

console.log('--- TESTE DE LEITURA DE CHAVES OKX ---');
console.log('API Key lida:', process.env.OKX_API_KEY ? 'Lida com sucesso' : '❌ ERRO: Chave API não lida');
console.log('Secret Key lida:', process.env.OKX_SECRET ? 'Lida com sucesso' : '❌ ERRO: Chave Secreta não lida');
console.log('Passphrase lida:', process.env.OKX_PASSWORD ? 'Lida com sucesso' : '❌ ERRO: Passphrase não lida');
console.log('----------------------------------------');

const exchange = new ccxt.okx({
    'apiKey': process.env.OKX_API_KEY,  
    'secret': process.env.OKX_SECRET,
    'password': process.env.OKX_PASSWORD, 
    'options': { 
        'defaultType': 'spot', 
        'defaultFees': { 
            trading: { 
                taker: okxFee 
            } 
        },
        'adjustForTimeDifference': true, 
    },
    timeout: 15000 
});

let marketInfo = {}; 

// ===========================================
// FUNÇÃO DE DESCOBERTA DE TRIÂNGULOS
// ===========================================

async function loadMarketsAndTriangles() {
    try {
        console.log("Carregando mercados da OKX...");
        marketInfo = await exchange.loadMarkets();
        console.log("Mercados carregados. Iniciando descoberta de triângulos...");
        
        const symbols = Object.keys(marketInfo).filter(symbol => marketInfo[symbol].spot);
        const uniqueBases = [...new Set(symbols.map(s => marketInfo[s].base))];
        const quoteCurrency = 'USDT'; // Moeda final de todos os triângulos
        
        let foundTriangles = [];
        
        // Estrutura de arbitragem: ALT -> BTC -> USDT
        for (const base of uniqueBases) {
            if (base === quoteCurrency || base === 'BTC') continue;

            const pair1 = `${base}/${quoteCurrency}`; // Ex: ETH/USDT
            if (!marketInfo[pair1]) continue;

            const pair2 = `${base}/BTC`; // Ex: ETH/BTC
            if (!marketInfo[pair2]) continue;

            const pair3 = `BTC/${quoteCurrency}`; // BTC/USDT
            if (!marketInfo[pair3]) continue;
            
            foundTriangles.push({
                alt: base,
                base: 'BTC',
                quote: quoteCurrency,
                pair1: pair1, 
                pair2: pair2, 
                pair3: pair3  
            });
        }

        trianglesToMonitor = foundTriangles;
        console.log(`✅ Descoberta Completa. Total de ${trianglesToMonitor.length} triângulos (A/BTC/USDT) encontrados na OKX.`);

    } catch (error) {
        console.error("❌ ERRO FATAL ao carregar mercados ou descobrir triângulos. ", error.message);
    }
}

// ===========================================
// FUNÇÃO DE EXECUÇÃO DE ORDEM
// ===========================================

async function executeTriangularArbitrage(triangle, profitPercent, prices, direction) {
    const { alt, pair1, pair2, pair3 } = triangle;
    
    if (!marketInfo[pair1] || !marketInfo[pair2] || !marketInfo[pair3]) {
        console.error("❌ Erro: Informações de mercado não carregadas. Pulando execução.");
        return;
    }

    console.log(`\n================== 🚀 EXECUÇÃO INICIADA na OKX ==================`);
    console.log('\x07\x07\x07'); 
    console.log(`  Triângulo: ${alt}/${triangle.base}/${triangle.quote} | Lucro Líquido: ${profitPercent.toFixed(4)}% | Rota: ${direction}`);
    console.log(`  Capital: ${tradeAmountUSDT} USDT`);

    try {
        if (direction === 'Direta') { 
            const [price1, price2, price3] = prices;

            // 1. COMPRAR ALT com USDT (em ALT/USDT)
            let amount1_alt = tradeAmountUSDT / price1;
            amount1_alt = exchange.amountToPrecision(pair1, amount1_alt); 
            console.log(`  -> 1. BUY ${amount1_alt} ${alt} em ${pair1} @ ${price1}`);
            const order1 = await exchange.createMarketBuyOrder(pair1, amount1_alt); 
            
            // 2. VENDER ALT por BTC (em ALT/BTC)
            let amount2_alt = parseFloat(order1.filled); 
            amount2_alt = exchange.amountToPrecision(pair2, amount2_alt);
            console.log(`  -> 2. SELL ${amount2_alt} ${alt} em ${pair2} @ ${price2}`);
            const order2 = await exchange.createMarketSellOrder(pair2, amount2_alt);
            
            // 3. VENDER BTC por USDT (em BTC/USDT)
            let amount3_btc = parseFloat(order2.filled); 
            amount3_btc = exchange.amountToPrecision(pair3, amount3_btc);
            console.log(`  -> 3. SELL ${amount3_btc} BTC em ${pair3} @ ${price3}`);
            const order3 = await exchange.createMarketSellOrder(pair3, amount3_btc);
            
            console.log(`\n✅ ARBITRAGEM COMPLETA. Retorno Final (Aproximado): ${parseFloat(order3.cost).toFixed(4)} USDT.`);
            
            logTransaction('SUCESSO', triangle, profitPercent, prices, `Ordem OK. Retorno final: ${parseFloat(order3.cost).toFixed(4)} USDT`);
            
        } else {
             console.log("  ⚠️ Rota Inversa detectada, mas a execução está desabilitada para simplificação.");
             logTransaction('DETECCAO_INVERSA', triangle, profitPercent, prices, 'Oportunidade inversa detectada, mas a execução está desabilitada.');
        }

    } catch (error) {
        console.error(`\n❌ ERRO FATAL AO EXECUTAR ARBITRAGEM na OKX: ${error.message}`);
        logTransaction('FALHA_EXECUCAO', triangle, profitPercent, prices, `ERRO: ${error.message}`);
    }
    console.log(`================================================================================`);
}


// ===========================================
// LÓGICA DE ARBITRAGEM TRIANGULAR
// ===========================================

async function checkTriangularArbitrage(exchange, triangle) {
    const { alt, pair1, pair2, pair3 } = triangle;
    
    try {
        const [book1, book2, book3] = await Promise.all([
            exchange.fetchOrderBook(pair1), 
            exchange.fetchOrderBook(pair2), 
            exchange.fetchOrderBook(pair3), 
        ]);
        
        // Rota Direta (USDT -> Alt -> BTC -> USDT)
        const price1_buy_alt_usdt = book1.asks[0][0]; 
        const price2_sell_alt_btc = book2.bids[0][0]; 
        const price3_sell_btc_usdt = book3.bids[0][0]; 

        let finalUSDT_route1 = (1 / price1_buy_alt_usdt) * price2_sell_alt_btc * price3_sell_btc_usdt;
        const netProfit1 = finalUSDT_route1 - 1 - (3 * okxFee); 
        
        // Rota Inversa (USDT -> BTC -> Alt -> USDT)
        const price1_buy_btc_usdt = book3.asks[0][0];
        const price2_buy_alt_btc = book2.asks[0][0]; 
        const price3_sell_alt_usdt = book1.bids[0][0];

        let finalUSDT_route2 = (1 / price1_buy_btc_usdt) / price2_buy_alt_btc * price3_sell_alt_usdt;
        const netProfit2 = finalUSDT_route2 - 1 - (3 * okxFee); 

        // ANÁLISE E EXECUÇÃO
        if (netProfit1 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit1 * 100), [price1_buy_alt_usdt, price2_sell_alt_btc, price3_sell_btc_usdt], 'Direta');
        } else if (netProfit2 > minProfitTriangular) {
            await executeTriangularArbitrage(triangle, (netProfit2 * 100), [price1_buy_btc_usdt, price2_buy_alt_btc, price3_sell_alt_usdt], 'Inversa');
        } 
        
        // LOGA TODAS AS OPORTUNIDADES ACIMA DO LUCRO MÍNIMO
        if (netProfit1 > minProfitTriangular) {
             logTransaction('DETECCAO_DIRETA', triangle, (netProfit1 * 100), [price1_buy_alt_usdt, price2_sell_alt_btc, price3_sell_btc_usdt], 'Oportunidade Direta detectada.');
        } else if (netProfit2 > minProfitTriangular) {
             logTransaction('DETECCAO_INVERSA', triangle, (netProfit2 * 100), [price1_buy_btc_usdt, price2_buy_alt_btc, price3_sell_alt_usdt], 'Oportunidade Inversa detectada.');
        }

    } catch (error) {
        // Ignorar erros comuns (como par não suportado ou erro temporário de conexão)
    }
}


// ===========================================
// FUNÇÃO PRINCIPAL QUE RODA EM LOOP
// ===========================================

async function mainLoop() {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA TRIANGULAR em ${trianglesToMonitor.length} pares...`);
    
    // Verifica saldos antes de entrar no loop de pares
    let balancesChecked = true;
    try {
        // Tenta buscar o saldo apenas da conta Spot/Trading
        const okxBalance = await exchange.fetchBalance(); 
        const okxUSDT = okxBalance.USDT ? okxBalance.USDT.free : 0;
        
        if (okxUSDT < tradeAmountUSDT) {
             console.log(`AVISO: Saldo insuficiente de USDT (${tradeAmountUSDT} USDT necessários). Saldo: ${okxUSDT.toFixed(2)} USDT.`);
             console.log(`⚠️ CONFIRME: O saldo de ${tradeAmountUSDT} USDT está na sua Conta de Negociação (Trading Account)?`);
             balancesChecked = false;
        } else {
             console.log(`✅ SALDO OK. Capital de Negociação: ${tradeAmountUSDT} USDT. Saldo Atual: ${okxUSDT.toFixed(2)} USDT.`);
        }

    } catch (error) {
        console.error('❌ ERRO FATAL ao checar saldos da OKX. Verifique as chaves, Passphrase e permissões.');
        return; 
    }
    
    if (balancesChecked) {
        for (const triangle of trianglesToMonitor) {
            await checkTriangularArbitrage(exchange, triangle); 
            // Pequeno delay para respeitar o Rate Limit da OKX
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
    } 
    
    console.log(`Busca Finalizada. Esperando ${interval / 1000}s...`);
}


// ===========================================
// INÍCIO DO BOT
// ===========================================

(async () => {
    // 1. Carrega os mercados e descobre todos os triângulos
    await loadMarketsAndTriangles(); 
    
    if (trianglesToMonitor.length > 0) {
        // 2. Inicia o loop de negociação
        setInterval(mainLoop, interval); 
    } else {
        console.log("❌ ERRO: Nenhum triângulo de arbitragem válido encontrado. O bot não pode iniciar.");
    }
})();
