const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
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
	req.body.author = req.user._id;
	const store = await (new Store(req.body)).save();
	req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	const page = req.params.page || 1;
	const limit = 6;
	const skip = (page * limit) - limit;
	const storesPromise = Store
		.find()
		.skip(skip)
		.limit(limit)
		.sort({ created: 'desc' });

	const countPromise = Store.count();
	const [stores, count] = await Promise.all([storesPromise, countPromise]);
	const pages = Math.ceil(count/limit);

	if(!stores.length && skip) {
		req.flash('info', `You asked for page ${page}. But that page doesn't exist. So here's the last page for you!`);
		res.redirect(`/store/page/${pages}`);
		return;
	}

	res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
	if(!store.author.equals(user._id)) {
		throw Error('You must be Owner of the Store to Edit it!');
	}
};

exports.editStore = async (req, res) => {
	// 1. Find the Store
	const store = await Store.findOne({ _id: req.params.id });
	
	// 2. Check if he is the owner
	confirmOwner(store, req.user);

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
	const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
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

// API Endpoints

exports.searchStores = async (req, res) => {
	const stores = await Store
	//Find the Stores
	.find({
		$text: {
			$search: req.query.q
		}
	}, 
	{
		score: { $meta: 'textScore' }
	})
	// Sort them according to textScore
	.sort({
		score: { $meta: 'textScore' }
	})
	// Limit to 5 results
	.limit(5);
	res.json(stores);
};

exports.mapStores = async (req, res) => {
	const coordinates = [req.query.lng , req.query.lat].map(parseFloat);

	const q = {
		location: {
			$near: {
				$geometry: {
					type: 'Point',
					coordinates
				},
				$maxDistance: 10000 // 10 km
			}
		}
	};

	const stores = await Store.find(q).select('slug name description location photo').limit(10);

	res.json(stores);
};

exports.mapPage = (req, res) => {
	res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
	const hearts = req.user.hearts.map(obj => obj.toString());
	const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
	const user = await User
		.findByIdAndUpdate(req.user._id, 
			{ [operator]: { hearts: req.params.id } },
			{ new: true }
		);

	res.json(user);
};

exports.getHearts = async (req, res) => {
	const stores = await Store.find({
		_id: { $in: req.user.hearts }
	});
	res.render('stores', { title: 'Hearted Stores', stores });
};

exports.topStores = async (req, res) => {
	const stores = await Store.getTopStores();
	// res.json(stores);
	res.render('topStores', { title: 'Top Stores', stores });
};