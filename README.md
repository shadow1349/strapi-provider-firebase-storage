# Strapi Provider Firebase Storage

<p align="center">
    <img src="https://i.imgur.com/3K2Y6g3.png">
</p>

This is a Strapi provider that will upload your files to Firebase Storage.

# Installation 

```
npm install strapi-provider-firebase-storage
```

## Note on CORS options

You may run into an issue displaying the image where CORS is blocking it. If that happens open `./config/middwares.js` and replace `strapi::security` with this:

```
{
  name: "strapi::security",
  config: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "connect-src": ["'self'", "https:"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "storage.googleapis.com",
          "dl.airtable.com",
        ],
        "media-src": [
          "'self'",
          "data:",
          "blob:",
          "storage.googleapis.com",
          "dl.airtable.com",
        ],
        upgradeInsecureRequests: null,
      },
    },
  },
},
```

It will whitelabel images coming from Google Cloud Storage in the CORS settings.

# Usage

Here is a sample usage:

```javascript
module.exports = ({ env }) => {
  return {
    ...
    upload: {
      config: {
        provider: "strapi-provider-firebase-storage",
        providerOptions: {
          serviceAccount: require("path/to/my/serviceAccount.json"),
          // Custom bucket name
          bucket: env(
            "STORAGE_BUCKET_URL",
            "my-bucket-name.appspot.com"
          ),
          sortInStorage: true, // true | false
          debug: false, // true | false
        },
      },
    },
    ...
  };
};
```

# Config Options

| Option           | Is Required | Default | Notes                                                                                                                      |
| :--------------- | :---------- | :------ | :------------------------------------------------------------------------------------------------------------------------- |
| `serviceAccount` | true        | none    | This is just the path to your service account file                                                                         |
| `bucket`         | false       | none    | If you leave this blank it **should** go to your default bucket, but I'd recommend putting your default bucket name anyway |
| `sortInStorage`  | false       | true    | This will sort files in your firebase storage bucket into folders                                                          |
| `debug`          | false       | false   | This will just log all the steps to the console                                                                            |

## Notes on the `sortInStorage` option

By default Strapi will just output all the files in the default bucket with no folder structure (even if you make folders in the Strapi admin UI). Strapi also creates
variants of files (like iamges ex. thumbnails) so if you upload an image to Strapi you'll actually have like a few variants of it actually uploaded to Firebase.

If you were to look at that in Firebase it would look like total chaos. So what I did was create a couple of functions that will upload your files based on mime type
as well as sort all variants of an image under a single folder. If you wanted to do something else with those images (for example create triggers for uploads for specific folders)
they will be sorted nicely for you.

Alos be really careful toggling the `sortInStorage` option. If you have it on, upload some files, then turn it off the
delete function **could** break for the files that were uploaded when it was turned on.
