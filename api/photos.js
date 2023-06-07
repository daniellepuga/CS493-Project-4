/*
 * API sub-router for businesses collection endpoints.
 */
const crypto = require('crypto');

const { Router } = require('express');
const amqp = require('amqplib');
const rabbitmqHost = process.env.RABBITMQ_HOST;
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

const { validateAgainstSchema } = require('../lib/validation')
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById,
  removeUploadedFile
} = require('../models/photo')

const router = Router()

const multer = require('multer');

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: (req, file, callback) => {
      const filename = crypto.pseudoRandomBytes(16).toString('hex');
      const extension = imageTypes[file.mimetype];
      callback(null, `${filename}.${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    callback(null, !!imageTypes[file.mimetype]);
  }
});

/*
 * POST /photos - Route to create a new photo.
 */
router.post(
  '/',
  upload.single('image'),
  (err, req, res, next) => {
    console.log(err);
    res.status(500).send({
      err: "An error occurred. Try again later."
    });
  },
  async (req, res) => {
    if (validateAgainstSchema(req.body, PhotoSchema) && req.file) {
      try {
        const photo = {
          contentType: req.file.mimetype,
          caption: req.body.caption,
          filename: req.file.filename,
          path: req.file.path,
          businessId: req.body.businessId
        };

        const id = await insertNewPhoto(photo)
        const connection = await amqp.connect(rabbitmqUrl);

        const channel = await connection.createChannel();
        channel.sendToQueue('thumbnail', Buffer.from(id.toString()));

        await removeUploadedFile(req.file)
        res.status(201).send({
          id: id,
          links: {
            photo: `/photos/${id}`,
            business: `/businesses/${req.body.businessId}`,
            media: `/media/images/${id}.${photo.filename.split('.')[1]}`,
            thumbnail: `/media/thumbnail/${id}.jpg`
          }
        })
      } catch (err) {
        console.error(err)
        res.status(500).send({
          error: "Error inserting photo into DB.  Please try again later."
        })
      }
    } else {
      res.status(400).send({
        error: "Request body is not a valid photo object"
      })
    }
  }
)

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id)
    if (photo) {
      const responseBody = {
        _id: photo._id,
        contentType: photo.metadata.contentType,
        businessId: photo.metadata.businessId,
        media: `/media/images/${req.params.id}.${photo.filename.split('.')[1]}`,
        thumbnail: `/media/thumbnail/${req.params.id}.jpg`
      };

      res.status(200).send(responseBody)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    })
  }
})

module.exports = router