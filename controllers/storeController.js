const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');
const multerOptions = {
	storage: multer.memoryStorage(),
	fileFilter(req, file, next) {
		const isPhoto = file.mimetype.startsWith('image/');
		if(isPhoto) {
			next(null, true);
		} else {
			next({ message: `This filetype is not supported!` }, false);
		}
	}
};

exports.homePage = (req, res) => {
	res.render('index');
};

exports.addStore = (req, res) => {
	res.render('editStore', {title: 'Add Store'});
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
	if (!req.file) {
		next(); //Skip to the next middleware
		return;
	}
	const extension = req.file.mimetype.split('/')[1];
	req.body.photo = `${uuid.v4()}.${extension}`;

	//Resize the Image
	const photo = await jimp.read(req.file.buffer);
	await photo.resize(800, jimp.AUTO);
	await photo.write(`./public/uploads/${req.body.photo}`);

	// Get on to next Phase
	next();
};

exports.createStore = async (req, res) => {
	const store = await (new Store(req.body)).save();
	req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	const stores = await Store.find();
	res.render('stores', { title: 'Stores', stores });
};

exports.editStore = async (req, res) => {
	// 1. Find the Store
	const store = await Store.findOne({ _id: req.params.id });
	
	// 2. Check if he is the owner

	// 3. Render Edit Form
	res.render('editStore', { title: `Edit ${store.name}`, store});
};

exports.updateStore = async (req, res) => {
	// 1. Find and Update Store
	const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
		new: true, //return updated store
		runValidators: true
	}).exec();
	req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href='/stores/${store.slug}'> View Store </a>`);
	// 2. Redirect and Notify the user
	res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res) => {
	const store = await Store.findOne({ slug: req.params.slug });
	if (!store) return next();
	res.render('store', { title: store.name, store});
};

exports.getStoresByTag = async (req, res) => {
	const currentTag = req.params.tag;
	const tagQuery = currentTag || { $exists: true };
	const tagsPromise = Store.getTagsList();
	const storePromise = Store.find({ tags: tagQuery });

	const [tags, stores] = await Promise.all([ tagsPromise, storePromise ]);

	res.render('tag', { tags, title: 'Tags', currentTag, stores });
	//res.json(stores);
};