const News = require('../Models/newsModel');
const User = require('../Models/userModel'); // Asegúrate de ajustar la ruta según tu estructura de archivos
const mongoose = require('mongoose');

// Traer las noticias
const getNews = async (req, res) => {
    try {
        const news = await News.find().sort({ createdAt: -1 }).limit(10);
        res.status(200).json(news);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Crear la noticia
const createNews = async (req, res) => {
    const { titulo, resumen, area, fecha } = req.body;

    if (!titulo || !resumen || !area) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    try {
        const newNews = new News({
            titulo,
            resumen,
            area,
            fecha
        });

        const savedNews = await newNews.save();

        // Enviar notificación a los usuarios del área correspondiente
        const notification = `Nueva publicación: ${titulo}\nFecha: ${fecha}\n\nResumen: ${resumen}`;

        await User.updateMany(
            { area },
            { $push: { notifications: notification } }
        );

        res.status(201).json(savedNews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getNews, createNews };
