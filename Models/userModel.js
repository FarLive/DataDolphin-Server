const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    nombre: {
        type: String,
        required: true
    },
    apellidoPaterno: {
        type: String,
        required: true
    },
    apellidoMaterno: {
        type: String,
        required: true
    },
    edad: {
        type: Number,
        required: true
    },
    area: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    photo: {
        type: String,
        required: false
    },
    verificationCode: {
        type: String
    },
    active: {
        type: Boolean,
        default: false
    },
    notifications: {
        type: [String],
        required: false
    },
    resetCode: {
        type: String
    }
});

// Método estático para signup
userSchema.statics.signup = async function(email, nombre, apellidoMaterno, apellidoPaterno, edad, area, password, photo, verificationCode) {
    if (!email || !password) {
        throw new Error('Todos los campos deben estar llenos');
    }

    if (!validator.isEmail(email)) {
        throw new Error('Email not valid');
    }

    if (!validator.isStrongPassword(password)) {
        throw new Error('Password not strong enough');
    }

    const exists = await this.findOne({ email });
    if (exists) {
        throw new Error('Email already in use');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = await this.create({ email, nombre, apellidoMaterno, apellidoPaterno, edad, area, password: hash, photo, verificationCode });

    return user;
}

// Método estático para login
userSchema.statics.login = async function(email, password) {
    if (!email || !password) {
        throw new Error('Todos los campos deben estar llenos');
    }

    const user = await this.findOne({ email });
    if (!user) {
        throw new Error('Incorrect Email');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error('Incorrect password');

    return user;
}

// Método para activar la cuenta del usuario
userSchema.statics.activateAccount = async function(verificationCode) {
    const user = await this.findOne({ verificationCode });

    if (!user) {
        throw new Error('Código de confirmación no válido');
    }

    user.active = true;
    user.verificationCode = undefined;
    await user.save();

    return user;
}

// Método estático para cambiar la contraseña usando un código de restablecimiento
userSchema.statics.resetPassword = async function(resetCode, newPassword) {
    const user = await this.findOne({ resetCode });

    if (!user) {
        throw new Error('Código de restablecimiento no válido');
    }

    if (!validator.isStrongPassword(newPassword)) {
        throw new Error('Password not strong enough');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCode = undefined;
    await user.save();

    return user;
}

module.exports = mongoose.model('User', userSchema);
