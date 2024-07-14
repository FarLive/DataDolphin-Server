require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Conexión exitosa a la base de datos');
  })
  .catch((error) => {
    console.error('Error al conectar a la base de datos:', error);
  });

const objectdb = mongoose.connection

//Exportar conexion mongoDB

objectdb.on('connected', () => {
    console.log('Conexion correcta a MongoDB');
});

objectdb.on('error', () => {
    console.log('Error en la conexion a MongoDB');
});

module.exports = mongoose