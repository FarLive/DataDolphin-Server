const express = require('express');
const { loginUser, signupUser, verifyAccount, updateUser, getUserByEmail, getAllUsers, deleteUser, getUserNotifications, deleteNotification, requestPasswordReset, resetPassword} = require('../Controllers/userController');

const router = express.Router();

const requireAuth = require( '../Middleware/requireAuth' );

//Login route
router.post( '/login', loginUser );

//Signuo route
router.post( '/signup', signupUser );

// Ruta para confirmar cuenta
router.post('/verify', verifyAccount);

// Ruta para solicitar la recuperación de contraseña
router.post('/request-password-reset', requestPasswordReset);

// Ruta para restablecer la contraseña
router.post('/reset-password', resetPassword);

router.use(requireAuth); //proteger las demas rutas

// Ruta para actualizar usuario
router.put('/update/:id', updateUser);

// Ruta para obtener los datos de un usuario por email
router.get('/user/:email', getUserByEmail);

// Ruta para obtener todos los usuarios
router.get('/users', getAllUsers);

// Ruta para eliminar un usuario
router.delete('/user/:id', deleteUser);

// Ruta para obtener notificaciones
router.get('/notifications', getUserNotifications); 

// Ruta para eliminar una notificacion
router.delete('/notifications/:notificationIndex', deleteNotification);

module.exports = router;