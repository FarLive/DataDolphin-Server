require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./Routes/users');
const newRoutes = require('./Routes/news')
const cors = require('cors');

const app = express();

//Conexión a la base
const connectionDB = require('./connection')

// Configuracion de middlewares
app.use(express.json());

app.use(cors({
    origin: [ process.env.ROUTE ]  //Rutas que tienen acceso permitido
}));

app.use(express.json());

app.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

// Configurar las rutas

// Rutas para el usuario
app.use( '/api/user', userRoutes );

// Rutas para las noticias
app.use( '/api/news', newRoutes );


// Configurar el puerto
const port = process.env.PORT

app.listen( port, () => {
    console.log( 'Servidor montado en el puerto ' + process.env.PORT );
});
