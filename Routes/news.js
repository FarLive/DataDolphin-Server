const express = require('express');
const { createNews, getNews } = require('../Controllers/newsController');

const router = express.Router();

const requireAuth = require( '../Middleware/requireAuth' );

// Ruta para crear noticia
router.post( '/createNew', createNews );

router.use(requireAuth); //proteger rutas/w

// Ruta para obtener las ultimas 10 noticias

router.get('/getNews', getNews) ;

module.exports = router;