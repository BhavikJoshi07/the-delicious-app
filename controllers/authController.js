const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const crypto = require('crypto');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
	failureRedirect: '/login',
	failureFlash: 'Failed Login!',
	successRedirect: '/',
	successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
	req.logout();
	req.flash('success', 'You have successfully logged out!');
	res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {

	if (req.isAuthenticated()) {
		next(); // User is Logged In! Continue!
		return;
	}
	req.flash('error', 'Oops! You must be Logged in to do that!');
	res.redirect('/login');
};

exports.forgot = async (req, res) => {
	// 1. Check if user exists
	const user = await User.findOne({ email: req.body.email });
	if (!user) {
		req.flash('error', 'No Account with that email address exists');
		res.redirect('/login');
	}
	// 2. Set Reset token and its expiry
	user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
	user.resetPasswordExpires = Date.now() + 3600000; // Token Expires in 1 Hour
	await user.save();
	// 3. Send the user Reset Token through Email
	const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
	await mail.send({
		user,
		subject: 'Password Reset',
		filename: 'password-reset',
		resetURL
	});
	req.flash('success', `You have been Emailed a Password Reset Link!`);
	// 4. Redirect to Login Page
	res.redirect('/login');
};

exports.reset = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	});

	if ( !user ) {
		req.flash('error', 'Reset Password Token is Invalid or Expired');
		return res.redirect('/login');
	}
	res.render('reset', { title: 'Reset Your Password' });
};

exports.cofirmedPasswords = (req, res, next) => {
	if( req.body.password === req.body['confirm-password'] ) {
		next(); // Keep Going
		return;
	}
	req.flash('error', 'Passwords do not match!');
	res.redirect('back');
};

exports.update = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	});

	if ( !user ) {
		req.flash('error', 'Reset Password Token is Invalid or Expired');
		return res.redirect('/login');
	}
	const setPassword = promisify(user.setPassword, user);
	await setPassword(req.body.password);
	user.resetPasswordToken = undefined;
	user.resetPasswordExpires = undefined;
	const updatedUser = await user.save();

	await req.login(updatedUser);
	req.flash('success', 'Your Passwords has been Reset! You are now Logged In!');
	res.redirect('/');
}