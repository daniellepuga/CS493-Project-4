const { Router } = require('express');
const router = Router();

const {
    getPhotoById,
    getImageDownloadStreamByFilename,
    getThumbnailDownloadStreamByFilename
} = require('../models/photo')

router.get('/images/:id', async (req, res, next) => {
    const photo = await getPhotoById(req.params.id.split('.')[0]);
    console.log(photo.filename);
    getImageDownloadStreamByFilename(photo.filename)
        .on('file', (file) => {
            res.status(200).type(file.metadata.contentType);
        })
        .on('error', (err) => {
            if (err.code === 'ENOENT') {
                next();
            } else {
                next(err);
            }
        })
        .pipe(res);
});

router.get('/thumbnail/:filename', (req, res, next) => {
    getThumbnailDownloadStreamByFilename(req.params.filename)
        .on('file', (file) => {
            res.status(200).type(file.metadata.contentType);
        })
        .on('error', (err) => {
            if (err.code === 'ENOENT') {
                next();
            } else {
                next(err);
            }
        })
        .pipe(res);
});

module.exports = router