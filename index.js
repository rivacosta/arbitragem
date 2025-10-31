// index.js - Bot de Arbitragem Inter-Exchange (GATE.IO <-> OKX)

const ccxt = require('ccxt');
require('dotenv').config();
const fs = require('fs'); 
// Se você instalou o 'beep', ele será usado. Se não, remova ou comente a linha '\x07\x07\x07'.

// ===========================================
// CONFIGURAÇÕES GLOBAIS DO BOT (LIDAS DO .env)
// ===========================================

// Lendo configurações de Capital e Risco do arquivo .env
const tradeAmountUSDT = parseFloat(process.env.CAPITAL_USDT) || 100; // Padrão: 100 USDT
const minProfitInterExchange = parseFloat(process.env.MIN_PROFIT_PERCENT) / 100 || 0.015; // Padrão: 1.5%

const interval = 3000; // Intervalo de busca (3 segundos)

// Taxas Taker (Típicas, verifique as suas!)
const okxFee = 0.001;     // 0.1%
const gateioFee = 0.002;  // 0.2% (Pode variar com o tier/volume)

// =========================================================================
// PARES A MONITORAR: Lista expandida para aumentar as chances de spread
// =========================================================================
const symbolsToMonitor = [
    'BTC/USDT', 
    'ETH/USDT', 
    'LTC/USDT',  // Baixa taxa e alta velocidade
    'XRP/USDT',  // Baixa taxa e alta velocidade
    'XLM/USDT',  // Uma das mais baratas e rápidas
    'ADA/USDT', 
    'SOL/USDT', 
    'DOT/USDT', 
    'MATIC/USDT', 
    'TRX/USDT',  // Boa velocidade de rede
    'ALGO/USDT', // Boa velocidade de rede
    'AVAX/USDT', // Altcoin de alto volume
    'NEAR/USDT'  // Altcoin de alto volume
];

// ===========================================
// FUNÇÃO PARA REGISTRAR LOG EM ARQUIVO CSV
// (Mantida do código anterior)
// ===========================================
function logTransaction(status, symbol, profitPercent, prices, message) {
    const timestamp = new Date().toISOString();
    const profit = profitPercent ? profitPercent.toFixed(4) + '%' : 'N/A';
    
    const logLine = `${timestamp},${status},${symbol},${profit},"${prices.join('|')}","${message.replace(/"/g, '""')}"\n`;
    const logFile = 'arbitragem_inter_exchange_log.csv';
    
    if (!fs.existsSync(logFile)) {
        const header = 'Timestamp,Status,Par,Lucro_Liquido,Precos_Ordem,Mensagem\n';
        fs.writeFileSync(logFile, header);
    }
    
    fs.appendFileSync(logFile, logLine);
}

// ===========================================
// INSTÂNCIAS DAS CORRETORAS
// ===========================================

const okx = new ccxt.okx({
    'apiKey': process.env.OKX_API_KEY,  
    'secret': process.env.OKX_SECRET,
    'password': process.env.OKX_PASSWORD, 
    'options': { 'defaultType': 'spot', 'adjustForTimeDifference': true },
    timeout: 15000 
});

const gateio = new ccxt.gateio({ // Corretora de Compra
    'apiKey': process.env.GATEIO_API_KEY,  
    'secret': process.env.GATEIO_SECRET,
    'options': { 'defaultType': 'spot', 'adjustForTimeDifference': true },
    timeout: 15000 
});

// ===========================================
// LÓGICA DE ARBITRAGEM INTER-EXCHANGE
// ===========================================

async function checkInterExchangeArbitrage(symbol) {
    let [gateioBook, okxBook] = [null, null];
    
    try {
        // Busca paralela para velocidade
        [gateioBook, okxBook] = await Promise.all([
            gateio.fetchOrderBook(symbol), 
            okx.fetchOrderBook(symbol)
        ]);
    } catch (error) {
        // Aqui o erro da OKX 50026 ou o MODULE_NOT_FOUND (se não corrigido) aparecerá
        console.error(`❌ Erro ao buscar Order Book para ${symbol}: ${error.message}`);
        return;
    }

    // Preço de compra na GATE.IO (Ask/Oferta mais barata)
    const gateioBuyPrice = gateioBook.asks.length > 0 ? gateioBook.asks[0][0] : null; 
    
    // Preço de venda na OKX (Bid/Demanda mais alta)
    const okxSellPrice = okxBook.bids.length > 0 ? okxBook.bids[0][0] : null; 

    if (!gateioBuyPrice || !okxSellPrice) {
        // console.log(`[${symbol}] Livro de ordens incompleto. Pulando.`);
        return;
    }

    // 1. Calcular o lucro bruto (a diferença percentual)
    const grossProfit = (okxSellPrice / gateioBuyPrice) - 1;

    // 2. Descontar as taxas de negociação nas duas pontas (Taker Fees)
    // Custo total: Compra na Gateio (Taker Fee) + Venda na OKX (Taker Fee)
    const netProfit = grossProfit - gateioFee - okxFee; 

    if (netProfit > minProfitInterExchange) {
        const profitPercent = netProfit * 100;

        console.log(`\n================== 🚨 OPORTUNIDADE ENCONTRADA 🚨 ==================`);
        // console.log('\x07\x07\x07'); // Alerta sonoro (Descomente se o 'beep' estiver instalado)
        console.log(`  PAR: ${symbol} | LUCRO LÍQUIDO (s/ taxa saque): ${profitPercent.toFixed(4)}%`);
        console.log(`  COMPRA GATE.IO @ ${gateioBuyPrice.toFixed(8)} | VENDA OKX @ ${okxSellPrice.toFixed(8)}`);
        
        // --- NOTA IMPORTANTE SOBRE A TAXA DE TRANSFERÊNCIA ---
        const asset = symbol.split('/')[0];
        const transferWarning = `Lembre-se: Lucro de ${profitPercent.toFixed(4)}% ainda não subtrai a taxa de saque do ${asset}! O custo de saque é muito baixo (centavos) para XLM/XRP/LTC/TRX, mas deve ser verificado.`;
        console.log(`  ${transferWarning}`);
        console.log(`  Capital de Negociação: ${tradeAmountUSDT} USDT.`);

        logTransaction('DETECCAO_INTER', symbol, profitPercent, [gateioBuyPrice, okxSellPrice], transferWarning);
        
        console.log(`\n  ⚠️ EXECUÇÃO MANUAL: Comprar ${asset} na GATE.IO -> Transferir ${asset} -> Vender ${asset} na OKX.`);
        console.log(`====================================================================`);
    }
}


// ===========================================
// FUNÇÃO PRINCIPAL QUE RODA EM LOOP
// ===========================================

async function mainLoop() {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleTimeString()}] INICIANDO BUSCA INTER-EXCHANGE em ${symbolsToMonitor.length} pares...`);
    console.log(`Corretoras: GATE.IO (Compra) <-> OKX (Venda)`);
    console.log(`Capital Sugerido: ${tradeAmountUSDT} USDT | Lucro Mínimo: ${(minProfitInterExchange * 100).toFixed(2)}%`);
    
    for (const symbol of symbolsToMonitor) {
        // Usamos await e um pequeno atraso para evitar sobrecarregar a API
        await checkInterExchangeArbitrage(symbol); 
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    console.log(`Busca Finalizada. Esperando ${interval / 1000}s...`);
}


// ===========================================
// INÍCIO DO BOT
// ===========================================

(async () => {
    // Apenas testar a conexão e carregar os mercados
    try {
        await Promise.all([okx.loadMarkets(), gateio.loadMarkets()]);
        console.log("✅ Conexões OKX e GATE.IO estabelecidas e mercados carregados.");
        console.log(`✅ Lendo do .env: Capital=${tradeAmountUSDT} USDT, Lucro Mínimo=${(minProfitInterExchange * 100).toFixed(2)}%`);
        console.log(`=> Lembre-se de instalar o módulo 'beep' se quiser o alerta sonoro de detecção!`);
    } catch (error) {
         console.error("❌ ERRO FATAL ao carregar mercados ou conectar às exchanges. Verifique as chaves API/Permissões.");
         console.error(error.message);
         return;
    }
    
    // Inicia o loop de negociação
    setInterval(mainLoop, interval); 
})();
