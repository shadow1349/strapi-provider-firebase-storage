import * as admin from "firebase-admin";
import * as path from "path";
import { v4 } from "uuid";
import {ReadStream} from 'fs';
import {ServiceAccount} from 'firebase-admin/lib/app/credential';

interface File {
  name: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
  formats?: Record<string, unknown>;
  hash: string;
  ext?: string;
  mime: string;
  size: number;
  url: string;
  previewUrl?: string;
  path?: string;
  provider?: string;
  provider_metadata?: Record<string, unknown>;
  stream?: ReadStream;
  buffer?: Buffer;
}

interface InitOptions {
  serviceAccount: string | ServiceAccount;
  bucket:string;
  sortInStorage?:boolean;
  debug?:boolean;
}

module.exports = {
  init(config: InitOptions) {
    admin.initializeApp({
      credential: admin.credential.cert(config.serviceAccount),
      // If you have a custom bucket this will set that bucket
      storageBucket: config.bucket,
    });

    // We set the custom bucket in the storageBucket option in the firbase admin init config
    const bucket = admin.storage().bucket();

    /**
     * This will help debug any potential issues with the library and can
     * be turned on/off from the config
     */
    function print(message?: any, ...optionalParams: any[]) {
      if (config.debug) console.log(message, ...optionalParams);
    }

    /**
     * Strapi creates multiple variants of the same image for thumbnails etc.
     * By default, Strapi will just output all the files in the base bucket and
     * that can be kind of a pain in the ass to look at.
     *
     * This function will grab the base file name from file variants like
     * "thumbnail_fileName" so I can use that as a folder path.
     */
    function getFileFolder(fileName: string) {
      print("FILE NAME: ", fileName);

      const tagRgx = /thumbnail_|large_|small_|medium_/gi;
      const name = path.parse(fileName).name;
      print("FILE NAME WITHOUT EXTENSION: ", name);

      const folderName = name.split(tagRgx).find((x) => !!x);
      print("FOLDER NAME: ", folderName);

      return folderName;
    }

    /**
     * To add a layer of organization I wanted to group all the images by their
     * type. Since we get the MIME type from the uploaded file from Strapi we can use
     * that to help group iamges in Firebase Storage.
     */
    function mimeTypeFolderGenerator(mime: string) {
      const mimeRgx = /image|video|pdf|font|javascript|html/gi;

      const matches = mime.match(mimeRgx);

      print("MIME MATCHES: ", matches);

      if (matches && matches.length > 0) {
        let folderName = matches[0];
        print("FOLDER NAME: ", folderName);

        folderName = folderName.toLocaleLowerCase();
        print("FOLDER NAME: ", folderName);

        const normalizedFolderName =
          folderName.charAt(0).toUpperCase() + folderName.slice(1);
        print("NORMALIZED FOLDER NAME: ", normalizedFolderName);

        return normalizedFolderName;
      }
      return "";
    }

    /**
     * We need the file ref for all functions so it makes sense to get that here.
     */
    function getFileRef(file: File) {
      const fileName = `${file.hash}${file.ext}`;
      print("FILE NAME: ", fileName);

      const basePath = mimeTypeFolderGenerator(file.mime);
      print("FILE BASE PATH: ", basePath);

      const fileFolderName = getFileFolder(file.hash);
      print("FILE FOLDER NAME: ", fileFolderName);

      const fullFilePath = `${
        basePath ? `${basePath}/` : ""
      }${fileFolderName}/${fileName}`;
      print("FILE FULL PATH: ", fullFilePath);

      return bucket.file(config.sortInStorage ? fullFilePath : fileName);
    }

    const upload = (file: File) =>
      new Promise((resolve, reject) => {
        const fileRef = getFileRef(file);

        const fileURL = `https://storage.googleapis.com/${config.bucket}/${fileRef.name}`;
        print("FILE URL: ", fileURL);

        const metadata = {
          metadata: {
            firebaseStorageDownloadTokens: v4(),
          },
        };

        if (file.stream) {
          const writeStream = fileRef.createWriteStream({
            public: true,
            contentType: file.mime,
            metadata,
          });

          file.stream
            .pipe(writeStream)
            .on("error", (error) => {
              if (config.debug) console.error(error);
              print("\n\n");
              reject(error);
            })
            .on("finish", async () => {
              /**
               * We need to set the file.url because this will go into the database and
               * will determine where the image is served from. If this isn't set then
               * it will break.
               */
              file.url = fileURL;
              print("\n\n");

              // Resolve just markes that the upload is complete
              resolve("");
            });
        } else if (file.buffer) {
          const fileBuffer = Buffer.from(file.buffer);

          fileRef.save(
            fileBuffer,
            {
              public: true,
              contentType: file.mime,
              metadata,
            },
            async (error) => {
              if (error) {
                if (config.debug) console.error(error);
                print("\n\n");
                reject(error);
              }

              /**
               * We need to set the file.url because this will go into the database and
               * will determine where the image is served from. If this isn't set then
               * it will break.
               */
              file.url = fileURL;
              print("\n\n");
              // Resolve just markes that the upload is complete
              resolve("");
            }
          );
        }
      });

    return {
      // We can have 1 function that handles file streams and buffers
      upload: (file: File) => upload(file),
      uploadStream: (file: File) => upload(file),
      delete: (file: File) =>
        new Promise((resolve, reject) => {
          const fileRef = getFileRef(file);
          fileRef.exists().then(([exists])=>{
            if(!exists){
              return resolve("");
            }
            fileRef
              .delete()
              .then(() => {
                print("\n\n");
                // Resolve just markes that the delete is complete
                resolve("");
              })
              .catch((error) => {
                if (config.debug) console.error(error);
                print("\n\n");
                reject(error);
              });
            })
        }),
    };
  },
};
