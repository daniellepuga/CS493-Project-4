/*
 * Photo schema and data accessor methods.
 */

const { ObjectId, GridFSBucket } = require('mongodb')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')

const fs = require('node:fs');

/*
 * Schema describing required/optional fields of a photo object.
 */
const PhotoSchema = {
  businessId: { required: true },
  caption: { required: false }
}
exports.PhotoSchema = PhotoSchema

/*
 * Executes a DB query to insert a new photo into the database.  Returns
 * a Promise that resolves to the ID of the newly-created photo entry.
 */
function removeUploadedFile(photo) {
  return new Promise((resolve, reject) => {
    fs.unlink(photo.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
exports.removeUploadedFile = removeUploadedFile

function insertNewPhoto(photo) {
  return new Promise((resolve, reject) => {
    const db = getDbReference();
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });

    const metadata = {
      contentType: photo.contentType,
      caption: photo.caption,
      businessId: photo.businessId,
      thumbnail_id: null
    };

    const uploadStream = bucket.openUploadStream(
      photo.filename,
      { metadata: metadata }
    );

    fs.createReadStream(photo.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id)
      });
  });
}
exports.insertNewPhoto = insertNewPhoto


/*
 * Executes a DB query to fetch a single specified photo based on its ID.
 * Returns a Promise that resolves to an object containing the requested
 * photo.  If no photo with the specified ID exists, the returned Promise
 * will resolve to null.
 */
async function getPhotoById(id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });

  // const collection = db.collection('photos')
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const results = await bucket
      .find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
}
exports.getPhotoById = getPhotoById

function getImageDownloadStreamByFilename(filename) {
  const db = getDbReference();
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });

  return bucket.openDownloadStreamByName(filename);
}
exports.getImageDownloadStreamByFilename = getImageDownloadStreamByFilename

function getThumbnailDownloadStreamByFilename(filename) {
  const db = getDbReference();
  const bucket = new GridFSBucket(db, { bucketName: 'thumbnail' });

  return bucket.openDownloadStreamByName(filename);
}
exports.getThumbnailDownloadStreamByFilename = getThumbnailDownloadStreamByFilename