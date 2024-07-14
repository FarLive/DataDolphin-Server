const mongoose = require( 'mongoose' );

const Schema = mongoose.Schema

const newsSchema = new Schema({

    titulo : {

        type : String,
        required : true

    },

    resumen : {

        type : String,
        required : true

    },

    fecha : {
        type : String,
        required : true
    },

    area : {

        type : String,
        required : true

    }

}, { timestamps : true });


module.exports = mongoose.model( 'news', newsSchema );