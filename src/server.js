const app = require('./app');
const port = Number(process.env.PORT || 3100);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Futebol API ouvindo na porta ${port}`);
});

function shutdown(signal) {
  console.log(`Recebido ${signal}; encerrando servidor...`);
  server.close((error) => {
    if (error) {
      console.error('Erro ao encerrar servidor:', error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
