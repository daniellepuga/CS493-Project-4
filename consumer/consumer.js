const amqp = require('amqplib');
const sharp = require('sharp');
const {
    getImageDownloadStreamByFilename,
    getPhotoById
} = require('../models/photo');
const { connectToDb, getDbReference } = require('../lib/mongo');
const { GridFSBucket } = require('mongodb');
const rabbitmqHost = process.env.RABBITMQ_HOST;
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updatePhotoMetadata(photo_id, thumbnail_id) {
    const db = getDbReference();
    await db.fs.files.update(
        { "_id": photo_id },
        {
            $set: { 'thumbnail_id': thumbnail_id }
        }
    );
    console.log(`thumbnail_id:${thumbnail_id}`);
}

async function create_thumbnail() {
    try {
        const connection = await amqp.connect(rabbitmqUrl);
        const channel = await connection.createChannel();
        await channel.assertQueue('thumbnail');

        channel.consume('thumbnail', async (msg) => {
            id = msg.content.toString();
            if (id) {
                const photo = await getPhotoById(id)
                const filename = photo.filename;
                const downloadStream = await getImageDownloadStreamByFilename(filename);

                const resizeToThumbnail =
                    sharp()
                        .resize(100, 100)
                        .jpeg();

                const db = getDbReference();
                console.log(`db: ${db}`);
                const bucket = new GridFSBucket(db, { bucketName: 'thumbnail' });

                const thumbnail_name = `${id}.jpg`;
                const metadata = {
                    contentType: "image/jpeg"
                }
                const uploadStream = bucket.openUploadStream(
                    thumbnail_name,
                    { metadata: metadata }
                )

                downloadStream
                    .pipe(resizeToThumbnail)
                    .pipe(uploadStream)
                    .on('finish', async (result) => {
                        await updatePhotoMetadata(id, result._id)
                    });
            }
            channel.ack(msg);
        })
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    await sleep(10000);
    await create_thumbnail();
}
connectToDb(main);