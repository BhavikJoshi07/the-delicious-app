const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
	name: {
		type: String,
		trim: true,
		required: 'Please enter a Store Name!'
	},
	slug: String,
	description: {
		type: String,
		trim: true
	},
	tags: [String],
	created: {
		type: Date,
		default: Date.now
	},
	location: {
		type: {
			type: String,
			default: 'Point'
		},
		coordinates: [{
			type: Number,
			required: 'You must supply Coordinates!'
		}],
		address: {
			type: String,
			required: 'You must supply an Address!'
		}
	},
	photo: String,
	author: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: 'You must supply an Author'
	}
},{
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({
	location: '2dsphere'
});

storeSchema.pre('save', async function(next) {
	if (!this.isModified('name')) {
		next();
		return;
	}
	this.slug = slug(this.name);

	//Check for Store with same slug name!
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
	const storeWithSlug = await this.constructor.find({ slug: slugRegEx });
	if(storeWithSlug.length) {
		this.slug = `${this.slug}-${storeWithSlug.length + 1}`;
	}
	//Goto Next
	next();
});

storeSchema.statics.getTagsList = function() {
	return this.aggregate([
		{ $unwind: '$tags' },
		{ $group: { _id: '$tags', count: { '$sum': 1 } } },
		{ $sort: { count: -1 } }
	]);
};

storeSchema.statics.getTopStores = function() {
	return this.aggregate([
	// Lookup Stores and Populate Reviews
	{ $lookup: {
			from: 'reviews',
			localField: '_id',
			foreignField: 'store',
			as: 'reviews'
	}},
	// Filter for only stores with 2 or more reviews
	{ $match: { 'reviews.1': {$exists: true} } },
	// Add Average Rating Field
	{ $project: {
		photo: '$$ROOT.photo',
		name: '$$ROOT.name',
		reviews: '$$ROOT.reviews',
		slug: '$$ROOT.slug',
		averageRating: { $avg: '$reviews.rating' }
	}},
	// Sort using Average Rating
	{ $sort: { averageRating: -1 } },
	//Limit the Results to 10
	{ $limit: 10 }
	]);
};

storeSchema.virtual('reviews', {
	ref: 'Review', // Model
	localField: '_id', // field on storeSchema
	foreignField: 'store' // field on reviewSchema
});

function autoPopulate(next) {
	this.populate('reviews');
	next();
};

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);


module.exports = mongoose.model('Store', storeSchema);