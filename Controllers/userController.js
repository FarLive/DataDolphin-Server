const User = require('../Models/userModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

//Hacemos la funcion para crear el token
const createToken = (user) => {
    return jwt.sign(
        { _id: user._id, email: user.email }, // Incluir email en el token
        process.env.SECRET,
        { expiresIn: '3d' }
    );
}

// Login user
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.login(email, password);

        // Creamos el token incluyendo el ID y el email
        const token = createToken(user);

        // Enviamos la foto del usuario junto con el token
        res.status(200).json({ email, token, photo: user.photo, active: user.active });
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


// Signup user
const signupUser = async (req, res) => {
    const { email, nombre, apellidoPaterno, apellidoMaterno, edad, area, password, photo } = req.body;

    try {
        const user = await User.signup(email, nombre, apellidoPaterno, apellidoMaterno, edad, area, password, photo);
        
        // Generar código de verificación
        const verificationCode = Math.random().toString(36).slice(2);
        
        // Guardar el código de verificación en el usuario
        user.verificationCode = verificationCode;
        await user.save();

        // Crear el token incluyendo el ID y el email
        const token = createToken(user);

        // Enviar respuesta exitosa
        res.status(200).json({ email, token, photo, active: user.active });
        
        // Enviar correo de verificación
        await sendVerificationEmail(email, verificationCode);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}


// Configurar el transportador de correo
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'datadolphin.ai@gmail.com',
        pass: 'nqot cgno cgsw rsre'
    }
});

// Función para enviar el código de verificación por correo electrónico
const sendVerificationEmail = async (email, verificationCode) => {
    const mailOptions = {
        from: 'datadolphin.ai@gmail.com',
        to: email,
        subject: `DataDolphin Código de Verificación: ${verificationCode}`,
        text: `DataDolphin\n\n\nRecibimos una solicitud para crear una cuenta asociada a este email.\n\nPara verificar tu cuenta, por favor introduce el siguiente código:\n\n\n\t${verificationCode}\n\n\nSi no solicitaste la verificación, puedes ignorar este email de forma segura.`
    };

    await transporter.sendMail(mailOptions);
}

const verifyAccount = async (req, res) => {
    const { verificationCode } = req.body;

    try {
        const user = await User.activateAccount(verificationCode);
        res.status(200).json({ message: 'Cuenta activada con éxito' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

// Función para actualizar usuario
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellidoPaterno, apellidoMaterno, edad, photo, email, area } = req.body;

    // Crear un objeto con solo los campos que realmente se han proporcionado en la solicitud
    let updates = {};
    if (nombre) updates.nombre = nombre;
    if (apellidoPaterno) updates.apellidoPaterno = apellidoPaterno;
    if (apellidoMaterno) updates.apellidoMaterno = apellidoMaterno;
    if (area) updates.area = area;
    if (email) updates.email = email;
    if (edad) updates.edad = edad;
    if (photo) updates.photo = photo;

    try {
        // Actualiza el usuario en la base de datos utilizando $set para asegurar que solo se actualizan los campos especificados
        const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

        // Si no se encuentra el usuario, enviar una respuesta de error
        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Si el usuario es encontrado y actualizado correctamente, enviar la información actualizada
        res.status(200).json({ message: 'Usuario actualizado con éxito', data: updatedUser });
    } catch (error) {
        // Manejar posibles errores de la base de datos o de la lógica
        res.status(500).json({ message: 'Error al actualizar el usuario', error: error });
    }
};

// Función para obtener un usuario por email
const getUserByEmail = async (req, res) => {
    const email = req.params.email;

    try {
        // Buscar el usuario por email. Solo se devuelven los campos necesarios.
        const user = await User.findOne({ email: email }, 'nombre apellidoPaterno apellidoMaterno edad area email photo _id');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Devolver los datos del usuario
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar el usuario', error: error });
    }
};

// Obtener todas las notificaciones de un usuario
const getUserNotifications = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId, 'notifications');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json({ notifications: user.notifications });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las notificaciones', error });
    }
};

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
    try {
      const users = await User.find({}, 'nombre apellidoPaterno apellidoMaterno email area');
      res.status(200).json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener los usuarios', error });
    }
};
  
// Eliminar usuario
const deleteUser = async (req, res) => {
    const { id } = req.params;
  
    try {
      const deletedUser = await User.findByIdAndDelete(id);
  
      if (!deletedUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
  
      res.status(200).json({ message: 'Usuario eliminado con éxito' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar el usuario', error });
    }
};

// Eliminar notificación
const deleteNotification = async (req, res) => {
    const userId = req.user._id;
    const { notificationIndex } = req.params;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (notificationIndex < 0 || notificationIndex >= user.notifications.length) {
            return res.status(400).json({ message: 'Índice de notificación no válido' });
        }

        user.notifications.splice(notificationIndex, 1);
        await user.save();

        res.status(200).json({ message: 'Notificación eliminada con éxito' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la notificación', error });
    }
};

// Enviar enlace para la recuperación de contraseña
const sendPasswordResetEmail = async (email, resetCode) => {
    const resetLink = `http://localhost:3000/recuperar-contraseña-form/${resetCode}`;
    const mailOptions = {
        from: 'datadolphin.ai@gmail.com',
        to: email,
        subject: 'Restablecer contraseña de DataDolphin',
        text: `Recibimos una solicitud para restablecer tu contraseña. Por favor, utiliza el siguiente enlace para restablecer tu contraseña:\n\n${resetLink}\n\nSi no solicitaste restablecer tu contraseña, ignora este correo.`
    };

    await transporter.sendMail(mailOptions);
}

// Función para solicitar la recuperación de contraseña
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const resetCode = crypto.randomBytes(20).toString('hex');
        user.resetCode = resetCode;
        await user.save();

        await sendPasswordResetEmail(email, resetCode);
        res.status(200).json({ message: 'Correo de recuperación enviado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Función para cambiar la contraseña
const resetPassword = async (req, res) => {
    const { resetCode, newPassword } = req.body;

    try {
        await User.resetPassword(resetCode, newPassword);
        res.status(200).json({ message: 'Contraseña restablecida con éxito' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


module.exports = {
    loginUser,
    signupUser,
    verifyAccount,
    updateUser,
    getUserByEmail,
    getAllUsers,
    deleteUser,
    getUserNotifications,
    deleteNotification,
    requestPasswordReset,
    resetPassword
};